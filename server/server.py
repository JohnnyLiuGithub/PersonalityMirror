import argparse
import base64
import hashlib
import hmac
import http.server
import json
import os
import re
import secrets
import socket
import socketserver
import sqlite3
import ssl
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

PORT = int(os.getenv('PORT', '8000'))
API_KEY = os.getenv('ARK_API_KEY')
API_URL = os.getenv('ARK_API_URL', 'https://ark.cn-beijing.volces.com/api/v3/chat/completions')
MODEL = os.getenv('ARK_MODEL', 'doubao-1-5-pro-32k-250115')
BACKEND_VERSION = '1.1.0'
DEBUG_MODE = os.getenv('DEBUG', '').lower() in {'1', 'true', 'yes', 'on'}
DB_PATH = os.getenv('SESSION_DB_PATH', os.path.join(os.path.dirname(__file__), 'sessions.db'))
DEFAULT_BLUEPRINT_PATH = os.path.join(os.path.dirname(__file__), 'question_blueprint.json')
AUTH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
PASSWORD_REGEX = re.compile(r'^[A-Za-z0-9_.@-]{3,64}$')
DIMENSIONS = ['attachment', 'control', 'self_value', 'conflict', 'action', 'desire', 'reflection']
QUESTION_VARIANT_TARGET = 20
QUESTION_VARIANT_BATCH_SIZE = 1
QUESTION_VARIANT_MAX_BATCH_ATTEMPTS = 20

ssl_context = ssl.create_default_context()
LIST_SPLIT_RE = re.compile(r'[\n,;，；、]+')
LIST_TRIM_RE = re.compile(r'^[\s\-\d\.\)\(]+|[\s\-\d\.\)\(]+$')


def safe_json_parse(raw, expected='object'):
    if isinstance(raw, (dict, list)):
        return raw
    if not isinstance(raw, str):
        return None

    text = raw.strip().replace('```json', '').replace('```', '').strip()
    open_char, close_char = ('[', ']') if expected == 'array' else ('{', '}')
    start = text.find(open_char)
    end = text.rfind(close_char)
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    try:
        return json.loads(text)
    except Exception:
        return None


def _format_error(prefix, exc):
    name = exc.__class__.__name__
    text = str(exc).strip()
    return f'{prefix} ({name}): {text}' if text else f'{prefix} ({name})'


def _stable_hash(text):
    value = 2166136261
    for ch in str(text):
        value ^= ord(ch)
        value = (value * 16777619) & 0xFFFFFFFF
    return value


def _now_ts():
    return int(time.time())


def _clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def _json_dumps(value):
    return json.dumps(value, ensure_ascii=False)


def extract_content(chat_payload):
    try:
        return chat_payload['choices'][0]['message']['content']
    except Exception:
        return ''


def call_model(messages, temperature=0.8, top_p=0.9, timeout=30, max_tokens=2200):
    if not API_KEY:
        raise RuntimeError('ARK_API_KEY is required')

    req_body = json.dumps(
        {
            'model': MODEL,
            'messages': messages,
            'temperature': temperature,
            'top_p': top_p,
            'max_tokens': max_tokens,
        }
    ).encode('utf-8')

    req = urllib.request.Request(
        API_URL,
        data=req_body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}',
        },
    )

    with urllib.request.urlopen(req, context=ssl_context, timeout=timeout) as response:
        body = response.read()
        return json.loads(body.decode('utf-8'))


DB_LOCK = threading.Lock()
DB_CONN = sqlite3.connect(DB_PATH, check_same_thread=False)
DB_CONN.row_factory = sqlite3.Row
QUESTION_VARIANT_LOCK = threading.Lock()
QUESTION_VARIANT_IN_PROGRESS = set()


def _db_execute(sql, params=()):
    with DB_LOCK:
        cursor = DB_CONN.execute(sql, params)
        DB_CONN.commit()
        return cursor


def _db_fetchone(sql, params=()):
    with DB_LOCK:
        return DB_CONN.execute(sql, params).fetchone()


def _db_fetchall(sql, params=()):
    with DB_LOCK:
        return DB_CONN.execute(sql, params).fetchall()


def _ensure_column(table_name, column_name, definition):
    columns = _db_fetchall(f'PRAGMA table_info({table_name})')
    if any(column['name'] == column_name for column in columns):
        return
    _db_execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}')


def init_db():
    _db_execute(
        '''
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          questions_json TEXT,
          report_json TEXT,
          scores_json TEXT,
          updated_at INTEGER NOT NULL
        )
        '''
    )

    _db_execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          username_norm TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
        '''
    )

    _db_execute(
        '''
        CREATE TABLE IF NOT EXISTS auth_tokens (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(user_id)
        )
        '''
    )

    _db_execute(
        '''
        CREATE TABLE IF NOT EXISTS test_records (
          record_id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          session_id TEXT,
          blueprint_version INTEGER NOT NULL,
          questions_json TEXT,
          answers_json TEXT,
          scores_json TEXT,
          main_type_json TEXT,
          shadow_type_json TEXT,
          short_answers_json TEXT,
          report_json TEXT,
          is_match_enabled INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(user_id)
        )
        '''
    )

    _ensure_column('test_records', 'questions_json', 'TEXT')
    _ensure_column('test_records', 'answers_json', 'TEXT')
    _ensure_column('test_records', 'scores_json', 'TEXT')
    _ensure_column('test_records', 'main_type_json', 'TEXT')
    _ensure_column('test_records', 'shadow_type_json', 'TEXT')
    _ensure_column('test_records', 'short_answers_json', 'TEXT')
    _ensure_column('test_records', 'report_json', 'TEXT')
    _ensure_column('test_records', 'is_match_enabled', 'INTEGER NOT NULL DEFAULT 0')
    _ensure_column('test_records', 'blueprint_version', 'INTEGER NOT NULL DEFAULT 1')
    _ensure_column('test_records', 'created_at', f'INTEGER NOT NULL DEFAULT {_now_ts()}')
    _ensure_column('test_records', 'updated_at', f'INTEGER NOT NULL DEFAULT {_now_ts()}')

    _db_execute(
        '''
        CREATE TABLE IF NOT EXISTS match_reports (
          match_id TEXT PRIMARY KEY,
          requester_user_id INTEGER NOT NULL,
          source_record_id TEXT NOT NULL,
          matched_record_id TEXT NOT NULL,
          compatibility_score INTEGER NOT NULL,
          report_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY(requester_user_id) REFERENCES users(user_id)
        )
        '''
    )

    _db_execute(
        '''
        CREATE TABLE IF NOT EXISTS question_variants (
          question_id TEXT NOT NULL,
          source_hash TEXT NOT NULL,
          variant_index INTEGER NOT NULL,
          variant_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(question_id, source_hash, variant_index)
        )
        '''
    )


init_db()


def db_get_session(session_id):
    row = _db_fetchone(
        'SELECT questions_json, report_json, scores_json FROM sessions WHERE session_id = ?',
        (session_id,),
    )
    if not row:
        return None

    return {
        'questions': safe_json_parse(row['questions_json'], expected='array') if row['questions_json'] else None,
        'report': safe_json_parse(row['report_json'], expected='object') if row['report_json'] else None,
        'scores': safe_json_parse(row['scores_json'], expected='object') if row['scores_json'] else None,
    }


def db_upsert_questions(session_id, questions):
    now_ts = _now_ts()
    _db_execute(
        '''
        INSERT INTO sessions(session_id, questions_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(session_id)
        DO UPDATE SET questions_json = excluded.questions_json, updated_at = excluded.updated_at
        ''',
        (session_id, _json_dumps(questions), now_ts),
    )


def db_upsert_report(session_id, report, scores):
    now_ts = _now_ts()
    _db_execute(
        '''
        INSERT INTO sessions(session_id, report_json, scores_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id)
        DO UPDATE SET report_json = excluded.report_json, scores_json = excluded.scores_json, updated_at = excluded.updated_at
        ''',
        (
            session_id,
            _json_dumps(report),
            _json_dumps(scores),
            now_ts,
        ),
    )


def _question_source_hash(question):
    return hashlib.sha256(
        json.dumps(question, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    ).hexdigest()[:16]


def db_list_question_variants(question_id, source_hash):
    rows = _db_fetchall(
        '''
        SELECT variant_json
        FROM question_variants
        WHERE question_id = ? AND source_hash = ?
        ORDER BY variant_index ASC
        ''',
        (question_id, source_hash),
    )
    return [safe_json_parse(row['variant_json'], expected='object') for row in rows]


def db_replace_question_variants(question_id, source_hash, variants):
    now_ts = _now_ts()
    with DB_LOCK:
        DB_CONN.execute(
            'DELETE FROM question_variants WHERE question_id = ? AND source_hash = ?',
            (question_id, source_hash),
        )
        DB_CONN.executemany(
            '''
            INSERT INTO question_variants(question_id, source_hash, variant_index, variant_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            [
                (
                    question_id,
                    source_hash,
                    index,
                    _json_dumps(variant),
                    now_ts,
                    now_ts,
                )
                for index, variant in enumerate(variants)
            ],
        )
        DB_CONN.commit()


def load_question_blueprint(path=DEFAULT_BLUEPRINT_PATH):
    with open(path, 'r', encoding='utf-8') as handle:
        payload = json.load(handle)
    if not isinstance(payload, list) or not payload:
        raise ValueError('question blueprint must be a non-empty JSON array')
    return payload


def normalize_username(username):
    return str(username or '').strip().lower()


def sanitize_public_user(row):
    if not row:
        return None
    return {
        'user_id': int(row['user_id']),
        'username': row['username'],
        'created_at': int(row['created_at']),
    }


def _hash_password(password, salt_bytes):
    derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt_bytes, 120000)
    return base64.b64encode(derived).decode('ascii')


def validate_credentials(username, password):
    username_text = str(username or '').strip()
    if not PASSWORD_REGEX.match(username_text):
        return None, 'Username must be 3-64 chars and use letters, numbers, ".", "_", "-", "@".'

    if not isinstance(password, str) or len(password) < 8:
        return None, 'Password must be at least 8 characters.'

    return username_text, None


def db_create_user(username, password):
    now_ts = _now_ts()
    salt_bytes = secrets.token_bytes(16)
    username_norm = normalize_username(username)
    password_hash = _hash_password(password, salt_bytes)

    try:
        _db_execute(
            '''
            INSERT INTO users(username, username_norm, password_hash, password_salt, created_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (
                username,
                username_norm,
                password_hash,
                base64.b64encode(salt_bytes).decode('ascii'),
                now_ts,
            ),
        )
    except sqlite3.IntegrityError:
        return None

    return db_get_user_by_username(username)


def db_get_user_by_username(username):
    return _db_fetchone(
        'SELECT user_id, username, username_norm, password_hash, password_salt, created_at FROM users WHERE username_norm = ?',
        (normalize_username(username),),
    )


def db_verify_user(username, password):
    row = db_get_user_by_username(username)
    if not row:
        return None

    try:
        salt_bytes = base64.b64decode(row['password_salt'])
    except Exception:
        return None

    computed = _hash_password(password, salt_bytes)
    if not hmac.compare_digest(computed, row['password_hash']):
        return None
    return row


def db_create_auth_token(user_id):
    now_ts = _now_ts()
    token = secrets.token_urlsafe(32)
    _db_execute(
        '''
        INSERT INTO auth_tokens(token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        ''',
        (token, user_id, now_ts, now_ts + AUTH_TOKEN_TTL_SECONDS),
    )
    return token


def db_revoke_auth_token(token):
    _db_execute('DELETE FROM auth_tokens WHERE token = ?', (token,))


def db_get_user_by_token(token):
    if not token:
        return None

    now_ts = _now_ts()
    _db_execute('DELETE FROM auth_tokens WHERE expires_at <= ?', (now_ts,))
    row = _db_fetchone(
        '''
        SELECT u.user_id, u.username, u.created_at
        FROM auth_tokens t
        JOIN users u ON u.user_id = t.user_id
        WHERE t.token = ? AND t.expires_at > ?
        ''',
        (token, now_ts),
    )
    return sanitize_public_user(row)


def validate_scores(scores):
    if not isinstance(scores, dict):
        return None

    normalized = {}
    for dimension in DIMENSIONS:
        numeric = scores.get(dimension)
        if not isinstance(numeric, (int, float)):
            return None
        normalized[dimension] = _clamp(int(round(numeric)), -100, 100)
    return normalized


def validate_type_payload(value):
    if not isinstance(value, dict):
        return None

    return {
        'id': str(value.get('id', '')).strip(),
        'name': str(value.get('name', '')).strip(),
        'traits': [str(item).strip() for item in value.get('traits', []) if str(item).strip()][:3],
        'insight': str(value.get('insight', '')).strip(),
    }


def validate_short_answers(value):
    if not isinstance(value, list):
        return []

    output = []
    for item in value[:8]:
        if not isinstance(item, dict):
            continue
        question_id = str(item.get('question_id', '')).strip()
        text = str(item.get('text', '')).strip()
        if question_id and text:
            output.append({'question_id': question_id, 'text': text[:300]})
    return output


def validate_report_schema(report):
    required = [
        'headline',
        'surface_persona',
        'core_drives',
        'defense_mechanisms',
        'relationship_pattern',
        'life_pattern',
        'risks',
        'growth_advice',
        'brutal_summary',
        'shadow_analysis',
        'card_label',
        'card_shadow_label',
        'card_traits',
        'card_insight',
    ]

    if not isinstance(report, dict):
        return None
    for key in required:
        if key not in report:
            return None

    def _to_list(value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            cleaned = value.replace('\r', '\n')
            parts = []
            for chunk in LIST_SPLIT_RE.split(cleaned):
                item = LIST_TRIM_RE.sub('', chunk).strip()
                if item:
                    parts.append(item)
            return parts
        return []

    defense_mechanisms = _to_list(report.get('defense_mechanisms'))
    risks = _to_list(report.get('risks'))
    growth_advice = _to_list(report.get('growth_advice'))
    card_traits = _to_list(report.get('card_traits'))

    if len(defense_mechanisms) < 2 or len(risks) < 2 or len(growth_advice) < 2 or len(card_traits) < 3:
        return None

    return {
        'headline': str(report.get('headline', '')).strip(),
        'surface_persona': str(report.get('surface_persona', '')).strip(),
        'core_drives': str(report.get('core_drives', '')).strip(),
        'defense_mechanisms': [str(x).strip() for x in defense_mechanisms if str(x).strip()][:2],
        'relationship_pattern': str(report.get('relationship_pattern', '')).strip(),
        'life_pattern': str(report.get('life_pattern', '')).strip(),
        'risks': [str(x).strip() for x in risks if str(x).strip()][:2],
        'growth_advice': [str(x).strip() for x in growth_advice if str(x).strip()][:2],
        'brutal_summary': str(report.get('brutal_summary', '')).strip()[:40],
        'shadow_analysis': str(report.get('shadow_analysis', '')).strip(),
        'card_label': str(report.get('card_label', '')).strip(),
        'card_shadow_label': str(report.get('card_shadow_label', '')).strip(),
        'card_traits': [str(x).strip() for x in card_traits if str(x).strip()][:3],
        'card_insight': str(report.get('card_insight', '')).strip(),
    }


def build_record_payload(data, report_override=None):
    session_id = data.get('session_id')
    blueprint_version = int(data.get('blueprint_version') or 1)
    report = report_override if report_override is not None else data.get('report')
    validated_report = validate_report_schema(report)
    validated_scores = validate_scores(data.get('scores'))
    validated_main = validate_type_payload(data.get('main_type'))
    validated_shadow = validate_type_payload(data.get('shadow_type'))

    if validated_report is None or validated_scores is None:
        return None

    questions = data.get('questions')
    answers = data.get('answers')
    if not isinstance(questions, list) or not isinstance(answers, dict):
        return None

    return {
        'session_id': session_id if isinstance(session_id, str) and session_id.strip() else None,
        'blueprint_version': blueprint_version,
        'questions': questions,
        'answers': answers,
        'scores': validated_scores,
        'main_type': validated_main,
        'shadow_type': validated_shadow,
        'short_answers': validate_short_answers(data.get('short_answers')),
        'report': validated_report,
    }


def _row_to_record_detail(row):
    report = safe_json_parse(row['report_json'], expected='object') or {}
    main_type = safe_json_parse(row['main_type_json'], expected='object') or {}
    shadow_type = safe_json_parse(row['shadow_type_json'], expected='object') or {}
    return {
        'record_id': row['record_id'],
        'session_id': row['session_id'],
        'blueprint_version': int(row['blueprint_version']),
        'questions': safe_json_parse(row['questions_json'], expected='array') or [],
        'answers': safe_json_parse(row['answers_json'], expected='object') or {},
        'scores': safe_json_parse(row['scores_json'], expected='object') or {},
        'main_type': main_type,
        'shadow_type': shadow_type,
        'short_answers': safe_json_parse(row['short_answers_json'], expected='array') or [],
        'report': report,
        'is_match_enabled': bool(row['is_match_enabled']),
        'created_at': int(row['created_at']),
        'updated_at': int(row['updated_at']),
        'headline': report.get('headline', ''),
        'brutal_summary': report.get('brutal_summary', ''),
        'main_label': main_type.get('name', ''),
        'shadow_label': shadow_type.get('name', ''),
    }


def _record_summary_from_detail(detail):
    return {
        'record_id': detail['record_id'],
        'created_at': detail['created_at'],
        'updated_at': detail['updated_at'],
        'headline': detail['headline'],
        'brutal_summary': detail['brutal_summary'],
        'main_label': detail['main_label'],
        'shadow_label': detail['shadow_label'],
        'is_match_enabled': detail['is_match_enabled'],
    }


def db_create_test_record(user_id, payload):
    now_ts = _now_ts()
    record_id = f'rec_{secrets.token_urlsafe(10)}'
    _db_execute(
        '''
        INSERT INTO test_records(
          record_id, user_id, session_id, blueprint_version, questions_json, answers_json,
          scores_json, main_type_json, shadow_type_json, short_answers_json, report_json,
          is_match_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ''',
        (
            record_id,
            user_id,
            payload['session_id'],
            payload['blueprint_version'],
            _json_dumps(payload['questions']),
            _json_dumps(payload['answers']),
            _json_dumps(payload['scores']),
            _json_dumps(payload['main_type']),
            _json_dumps(payload['shadow_type']),
            _json_dumps(payload['short_answers']),
            _json_dumps(payload['report']),
            now_ts,
            now_ts,
        ),
    )
    return db_get_record_for_user(user_id, record_id)


def db_list_records_for_user(user_id):
    rows = _db_fetchall(
        '''
        SELECT * FROM test_records
        WHERE user_id = ?
        ORDER BY created_at DESC, rowid DESC
        ''',
        (user_id,),
    )
    return [_record_summary_from_detail(_row_to_record_detail(row)) for row in rows]


def db_get_record_for_user(user_id, record_id):
    row = _db_fetchone(
        'SELECT * FROM test_records WHERE user_id = ? AND record_id = ?',
        (user_id, record_id),
    )
    return _row_to_record_detail(row) if row else None


def db_get_latest_record_for_user(user_id):
    row = _db_fetchone(
        '''
        SELECT * FROM test_records
        WHERE user_id = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
        ''',
        (user_id,),
    )
    return _row_to_record_detail(row) if row else None


def db_set_match_enabled(user_id, record_id, enabled):
    now_ts = _now_ts()
    _db_execute(
        '''
        UPDATE test_records
        SET is_match_enabled = ?, updated_at = ?
        WHERE user_id = ? AND record_id = ?
        ''',
        (1 if enabled else 0, now_ts, user_id, record_id),
    )
    return db_get_record_for_user(user_id, record_id)


def db_get_random_match_candidate(excluded_user_id):
    rows = _db_fetchall(
        '''
        SELECT tr.*
        FROM test_records tr
        JOIN (
          SELECT user_id, MAX(created_at) AS latest_created_at
          FROM test_records
          WHERE is_match_enabled = 1 AND user_id != ?
          GROUP BY user_id
        ) latest
          ON latest.user_id = tr.user_id AND latest.latest_created_at = tr.created_at
        WHERE tr.is_match_enabled = 1 AND tr.user_id != ?
        ''',
        (excluded_user_id, excluded_user_id),
    )
    if not rows:
        return None
    row = secrets.choice(rows)
    return _row_to_record_detail(row)


def db_save_match_report(user_id, source_record_id, matched_record_id, compatibility_score, report):
    match_id = f'match_{secrets.token_urlsafe(10)}'
    _db_execute(
        '''
        INSERT INTO match_reports(match_id, requester_user_id, source_record_id, matched_record_id, compatibility_score, report_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            match_id,
            user_id,
            source_record_id,
            matched_record_id,
            int(compatibility_score),
            _json_dumps(report),
            _now_ts(),
        ),
    )
    return match_id


def db_get_global_stats():
    total_tests = _db_fetchone(
        'SELECT COUNT(*) AS count FROM sessions WHERE report_json IS NOT NULL'
    )['count']
    total_matches = _db_fetchone(
        'SELECT COUNT(*) AS count FROM match_reports'
    )['count']
    return {
        'total_tests': int(total_tests or 0),
        'total_matches': int(total_matches or 0),
    }


def db_get_user_stats(user_id):
    tested_count = _db_fetchone(
        'SELECT COUNT(*) AS count FROM test_records WHERE user_id = ?',
        (user_id,),
    )['count']
    initiated_matches = _db_fetchone(
        'SELECT COUNT(*) AS count FROM match_reports WHERE requester_user_id = ?',
        (user_id,),
    )['count']
    received_matches = _db_fetchone(
        '''
        SELECT COUNT(*) AS count
        FROM match_reports mr
        JOIN test_records tr ON tr.record_id = mr.matched_record_id
        WHERE tr.user_id = ?
        ''',
        (user_id,),
    )['count']
    return {
        'tested_count': int(tested_count or 0),
        'initiated_matches': int(initiated_matches or 0),
        'received_matches': int(received_matches or 0),
    }


def _build_match_profile(record):
    return {
        'headline': str(record.get('headline', '')).strip(),
        'main_label': str(record.get('main_label', '')).strip(),
        'shadow_label': str(record.get('shadow_label', '')).strip(),
    }


def _make_question_brief(blueprint):
    brief = []
    for item in blueprint:
        if not isinstance(item, dict):
            continue

        q_type = item.get('type')
        row = {
            'i': item.get('id'),
            't': q_type,
            'd': item.get('dimension_primary'),
            's': item.get('scenario', ''),
            'q': item.get('question_text', ''),
        }

        if q_type == 'mcq':
            row['o'] = item.get('options', [])
            row['sk'] = item.get('scoring_key')
        elif q_type == 'rank':
            row['r'] = item.get('rank_items', [])
        elif q_type == 'short':
            row['ah'] = item.get('answer_hint', '')

        brief.append(row)

    return brief


VARIATION_THEMES = [
    'private-vs-public',
    'distance-and-repair',
    'pressure-and-choice',
    'status-and-exposure',
    'desire-and-restraint',
    'ambiguity-and-control',
]

VARIATION_CONTEXTS = [
    'workplace',
    'family',
    'friendship',
    'romance',
    'group chat',
    'travel',
    'money',
    'creative project',
    'temporary team',
    'social media',
    'shared living',
    'public event',
]

VARIATION_FRAMES = [
    'dialogue-moment',
    'aftermath',
    'before-decision',
    'sudden-message',
    'silent-tension',
    'public-feedback',
    'private-thought',
    'micro-conflict',
]

VARIATION_ANGLES = [
    'first reaction',
    'inner feeling',
    'hidden motive',
    'practical choice',
    'protective move',
    'what you do not say',
]


def _build_question_variation_plan(session_id, blueprint):
    seed = _stable_hash(session_id or 'pm-default-session')
    theme = VARIATION_THEMES[seed % len(VARIATION_THEMES)]
    plan = []

    for index, item in enumerate(blueprint):
        offset = (seed + index * 17) & 0xFFFFFFFF
        plan.append(
            {
                'i': item.get('id'),
                'c': VARIATION_CONTEXTS[offset % len(VARIATION_CONTEXTS)],
                'f': VARIATION_FRAMES[(offset // 7) % len(VARIATION_FRAMES)],
                'a': VARIATION_ANGLES[(offset // 13) % len(VARIATION_ANGLES)],
            }
        )

    return {'theme': theme, 'items': plan}


def _build_question_prompt(compact_blueprint, variation_plan):
    return (
        'Rewrite this questionnaire in Chinese with strong surface variation, not slight paraphrase. '
        'Keep the psychology intent unchanged. '
        'Return JSON array only, same item count as bp, no markdown, no extra fields. '
        'Output item fields: '
        'mcq=id,type,dimension_primary,scenario,question_text,options,scoring_key; '
        'rank=id,type,dimension_primary,scenario,question_text,rank_items; '
        'short=id,type,dimension_primary,scenario,question_text,answer_hint. '
        'Rules: preserve id/type/dimension_primary exactly. '
        'For mcq preserve scoring_key exactly and return exactly 4 distinct options. '
        'For rank keep rank_items exactly as bp. '
        'For short include answer_hint. '
        'Keep scenario/question concise. '
        'Treat bp text as latent intent, not wording to paraphrase. '
        'Avoid reusing the same nouns, sentence shapes, and scene setup from bp unless required by meaning. '
        'Use vp to force different contexts, framing, and emotional angle for each item. '
        'Change the outer scene, relationship role, and narrative perspective while preserving the tested psychology. '
        f'vp={json.dumps(variation_plan, ensure_ascii=False, separators=(",", ":"))} '
        f'bp={json.dumps(compact_blueprint, ensure_ascii=False, separators=(",", ":"))}'
    )


def normalize_questions(generated, blueprint):
    if not isinstance(generated, list) or not isinstance(blueprint, list):
        return None

    generated_by_id = {
        item.get('id'): item
        for item in generated
        if isinstance(item, dict) and item.get('id')
    }

    output = []
    for idx, source in enumerate(blueprint):
        if not isinstance(source, dict):
            return None

        candidate = generated_by_id.get(source.get('id'))
        if not isinstance(candidate, dict):
            if idx < len(generated) and isinstance(generated[idx], dict):
                candidate = generated[idx]
            else:
                return None

        if candidate.get('type') != source.get('type'):
            return None
        if candidate.get('dimension_primary') != source.get('dimension_primary'):
            return None

        merged = dict(source)
        merged['scenario'] = str(candidate.get('scenario', source.get('scenario', ''))).strip()
        merged['question_text'] = str(candidate.get('question_text', source.get('question_text', ''))).strip()
        if not merged['scenario'] or not merged['question_text']:
            return None

        q_type = source.get('type')
        if q_type == 'mcq':
            options = candidate.get('options')
            if not isinstance(options, list) or len(options) != len(source.get('options', [])):
                return None
            cleaned = [str(x).strip() for x in options]
            if '' in cleaned or len(set(cleaned)) != len(cleaned):
                return None
            merged['options'] = cleaned
            merged['scoring_key'] = source.get('scoring_key')
        elif q_type == 'rank':
            merged['rank_items'] = source.get('rank_items')
            merged['rank_map'] = source.get('rank_map')
            merged['scoring_key'] = source.get('scoring_key')
        elif q_type == 'short':
            merged['answer_hint'] = (
                str(candidate.get('answer_hint', source.get('answer_hint', ''))).strip()
                or source.get('answer_hint', '')
            )

        output.append(merged)

    return output if len(output) == len(blueprint) else None


def _repair_questions_json_with_ai(raw_text, compact_blueprint):
    messages = [
        {
            'role': 'system',
            'content': (
                'You fix invalid JSON for questionnaire generation. '
                'Return valid JSON array only. '
                'Keep item count unchanged. Keep id/type/dimension_primary/scoring_key unchanged. '
                'mcq options must be 4 distinct Chinese strings. '
                'rank_items must stay unchanged. '
                'short must include answer_hint.'
            ),
        },
        {
            'role': 'user',
            'content': (
                'Fix the output to valid JSON array only.\n'
                f'Blueprint:{json.dumps(compact_blueprint, ensure_ascii=False, separators=(",", ":"))}\n'
                f'RawOutput:{raw_text}'
            ),
        },
    ]
    payload = call_model(messages, temperature=0.1, top_p=1, timeout=20, max_tokens=1700)
    return extract_content(payload)


def generate_question_set_with_ai(session_id, blueprint, timeout=180):
    compact_blueprint = _make_question_brief(blueprint)
    variation_plan = _build_question_variation_plan(session_id, blueprint)
    prompt = _build_question_prompt(compact_blueprint, variation_plan)
    messages = [
        {
            'role': 'system',
            'content': (
                'You are a strict JSON generator for questionnaires. '
                'Output valid JSON array only. '
                'Chinese user-facing text only. '
                'No markdown. No explanations. '
                'Your job is to preserve intent while making the surface form feel materially new.'
            ),
        },
        {'role': 'user', 'content': prompt},
    ]

    try:
        payload = call_model(
            messages,
            temperature=0.9,
            top_p=0.88,
            timeout=timeout,
            max_tokens=1700,
        )
        content = extract_content(payload)
        parsed = safe_json_parse(content, expected='array')
        normalized = normalize_questions(parsed, blueprint)
        if normalized:
            return normalized, None
        return None, 'AI returned invalid question JSON for full set'
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode('utf-8', errors='ignore').strip()
        except Exception:
            detail = str(exc)
        return None, f'HTTP {exc.code} - {detail or "no response body"}'
    except urllib.error.URLError as exc:
        return None, _format_error('Network error', exc)
    except TimeoutError as exc:
        return None, _format_error('Model API timeout', exc)
    except socket.timeout as exc:
        return None, _format_error('Socket timeout', exc)
    except Exception as exc:
        return None, _format_error('Unexpected error', exc)


def _build_single_question_variant_plan(question, count, offset_seed=0):
    seed = _stable_hash(question.get('id', 'pm-question'))
    slots = []
    for index in range(count):
        logical_index = offset_seed + index
        offset = (seed + logical_index * 31) & 0xFFFFFFFF
        slots.append(
            {
                'n': logical_index + 1,
                'c': VARIATION_CONTEXTS[offset % len(VARIATION_CONTEXTS)],
                'f': VARIATION_FRAMES[(offset // 5) % len(VARIATION_FRAMES)],
                'a': VARIATION_ANGLES[(offset // 11) % len(VARIATION_ANGLES)],
                't': VARIATION_THEMES[(offset // 17) % len(VARIATION_THEMES)],
            }
        )
    return slots


def _build_single_question_variants_prompt(question, slots):
    compact = _make_question_brief([question])[0]
    variant_count = len(slots)
    return (
        f'Generate {variant_count} surface variants for one questionnaire item in Chinese. '
        f'Return JSON array only, exactly {variant_count} items, no markdown, no explanations. '
        'Each variant must preserve the same psychology intent. '
        'Each variant must preserve id,type,dimension_primary exactly. '
        'Rules by type: '
        'mcq must return scenario,question_text,options,scoring_key; keep scoring_key exactly and use exactly 4 distinct options. '
        'rank must return scenario,question_text,rank_items; keep rank_items exactly. '
        'short must return scenario,question_text,answer_hint. '
        'The variants must feel materially different in scene, framing, and wording, not tiny paraphrases. '
        f'slots={json.dumps(slots, ensure_ascii=False, separators=(",", ":"))} '
        f'item={json.dumps(compact, ensure_ascii=False, separators=(",", ":"))}'
    )


def _question_variant_signature(item):
    return json.dumps(
        {
            'scenario': item.get('scenario'),
            'question_text': item.get('question_text'),
            'options': item.get('options'),
            'answer_hint': item.get('answer_hint'),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(',', ':'),
    )


def _normalize_question_variants(generated, source, existing_signatures=None):
    if not isinstance(generated, list):
        return []

    output = []
    seen = set(existing_signatures or ())
    for candidate in generated:
        normalized = normalize_questions([candidate], [source])
        if not normalized:
            continue
        item = normalized[0]
        signature = _question_variant_signature(item)
        if signature in seen:
            continue
        seen.add(signature)
        output.append(item)
    return output


def _repair_question_variants_json_with_ai(raw_text, question, expected_count):
    compact = _make_question_brief([question])[0]
    messages = [
        {
            'role': 'system',
            'content': (
                'You fix invalid JSON for question variants. '
                f'Return a valid JSON array of exactly {expected_count} items only. '
                'Each item must preserve id,type,dimension_primary and required fields. '
                'No markdown. No extra fields.'
            ),
        },
        {
            'role': 'user',
            'content': (
                f'Fix this output to a valid {expected_count}-item JSON array.\n'
                f'Question:{json.dumps(compact, ensure_ascii=False, separators=(",", ":"))}\n'
                f'RawOutput:{raw_text}'
            ),
        },
    ]
    payload = call_model(messages, temperature=0.1, top_p=1, timeout=12, max_tokens=520)
    return extract_content(payload)


def _generate_question_variant_batch_with_ai(question, slots, existing_signatures=None):
    prompt = _build_single_question_variants_prompt(question, slots)
    messages = [
        {
            'role': 'system',
            'content': (
                'You are a strict JSON generator for question variants. '
                'Output valid JSON array only. '
                'Language must be Chinese. '
                'No markdown.'
            ),
        },
        {'role': 'user', 'content': prompt},
    ]

    attempts = [
        {'timeout': 12, 'temperature': 0.85, 'top_p': 0.85, 'max_tokens': 520},
        {'timeout': 18, 'temperature': 0.75, 'top_p': 0.8, 'max_tokens': 520},
    ]

    errors = []
    expected_count = len(slots)
    for index, cfg in enumerate(attempts, start=1):
        try:
            payload = call_model(
                messages,
                temperature=cfg['temperature'],
                top_p=cfg['top_p'],
                timeout=cfg['timeout'],
                max_tokens=cfg['max_tokens'],
            )
            content = extract_content(payload)
            parsed = safe_json_parse(content, expected='array')
            normalized = _normalize_question_variants(parsed, question, existing_signatures=existing_signatures)
            if normalized:
                return normalized, None

            repaired_text = _repair_question_variants_json_with_ai(content, question, expected_count)
            repaired_parsed = safe_json_parse(repaired_text, expected='array')
            repaired_normalized = _normalize_question_variants(
                repaired_parsed,
                question,
                existing_signatures=existing_signatures,
            )
            if repaired_normalized:
                return repaired_normalized, None

            best_count = max(len(normalized), len(repaired_normalized))
            errors.append(f'attempt {index}: valid variants {best_count}/{expected_count}')
        except urllib.error.HTTPError as exc:
            try:
                detail = exc.read().decode('utf-8', errors='ignore').strip()
            except Exception:
                detail = str(exc)
            errors.append(f'attempt {index}: HTTP {exc.code} - {detail or "no response body"}')
        except urllib.error.URLError as exc:
            errors.append(f'attempt {index}: ' + _format_error('Network error', exc))
        except TimeoutError as exc:
            errors.append(f'attempt {index}: ' + _format_error('Model API timeout', exc))
        except socket.timeout as exc:
            errors.append(f'attempt {index}: ' + _format_error('Socket timeout', exc))
        except Exception as exc:
            errors.append(f'attempt {index}: ' + _format_error('Unexpected error', exc))

    return [], ' | '.join(errors) if errors else 'unknown AI question variant batch generation error'


def _generate_question_variants_with_ai(question, existing_variants=None, target_count=QUESTION_VARIANT_TARGET):
    collected = list(existing_variants or [])
    existing_signatures = {_question_variant_signature(item) for item in collected if isinstance(item, dict)}
    errors = []
    logical_offset = len(collected)

    while len(collected) < target_count and logical_offset < QUESTION_VARIANT_MAX_BATCH_ATTEMPTS * QUESTION_VARIANT_BATCH_SIZE:
        remaining = target_count - len(collected)
        batch_size = min(QUESTION_VARIANT_BATCH_SIZE, remaining)
        slots = _build_single_question_variant_plan(question, batch_size, offset_seed=logical_offset)
        batch, error = _generate_question_variant_batch_with_ai(
            question,
            slots,
            existing_signatures=existing_signatures,
        )
        logical_offset += batch_size

        if batch:
            for item in batch:
                signature = _question_variant_signature(item)
                if signature in existing_signatures:
                    continue
                existing_signatures.add(signature)
                collected.append(item)
                if len(collected) >= target_count:
                    break
        elif error:
            errors.append(error)

    return collected[:target_count], ' | '.join(errors) if errors else None


def _fill_question_variant_pool(question, source_hash, target_count=QUESTION_VARIANT_TARGET, persist_each_batch=False, progress_callback=None):
    question_id = str(question.get('id', '')).strip()
    collected = [item for item in db_list_question_variants(question_id, source_hash) if isinstance(item, dict)]
    existing_signatures = {_question_variant_signature(item) for item in collected}
    errors = []
    logical_offset = len(collected)

    while len(collected) < target_count and logical_offset < QUESTION_VARIANT_MAX_BATCH_ATTEMPTS * QUESTION_VARIANT_BATCH_SIZE:
        remaining = target_count - len(collected)
        batch_size = min(QUESTION_VARIANT_BATCH_SIZE, remaining)
        slots = _build_single_question_variant_plan(question, batch_size, offset_seed=logical_offset)
        batch, error = _generate_question_variant_batch_with_ai(
            question,
            slots,
            existing_signatures=existing_signatures,
        )
        logical_offset += batch_size

        added = 0
        for item in batch:
            signature = _question_variant_signature(item)
            if signature in existing_signatures:
                continue
            existing_signatures.add(signature)
            collected.append(item)
            added += 1

        if added > 0 and persist_each_batch:
            db_replace_question_variants(question_id, source_hash, collected[:target_count])
        if progress_callback:
            progress_callback(
                {
                    'question_id': question_id,
                    'current_count': len(collected),
                    'target_count': target_count,
                    'added': added,
                    'error': error,
                }
            )

        if error:
            errors.append(error)

    return collected[:target_count], ' | '.join(errors) if errors else None


def _warm_question_variants_worker(question):
    question_id = str(question.get('id', '')).strip()
    source_hash = _question_source_hash(question)
    key = (question_id, source_hash)
    try:
        variants, error = _fill_question_variant_pool(
            question,
            source_hash,
            target_count=QUESTION_VARIANT_TARGET,
            persist_each_batch=True,
        )
        if variants:
            db_replace_question_variants(question_id, source_hash, variants)
        elif DEBUG_MODE:
            print(f'Question variant warmup failed for {question_id}: {error}')
    finally:
        with QUESTION_VARIANT_LOCK:
            QUESTION_VARIANT_IN_PROGRESS.discard(key)


def _warm_question_variant_batch_worker(questions):
    for question in questions:
        _warm_question_variants_worker(question)


def _ensure_question_variant_pool_async(blueprint):
    pending_questions = []
    for question in blueprint:
        if not isinstance(question, dict):
            continue

        question_id = str(question.get('id', '')).strip()
        if not question_id:
            continue

        source_hash = _question_source_hash(question)
        variants = db_list_question_variants(question_id, source_hash)
        if len([item for item in variants if isinstance(item, dict)]) >= QUESTION_VARIANT_TARGET:
            continue

        key = (question_id, source_hash)
        with QUESTION_VARIANT_LOCK:
            if key in QUESTION_VARIANT_IN_PROGRESS:
                continue
            QUESTION_VARIANT_IN_PROGRESS.add(key)
        pending_questions.append(dict(question))

    if pending_questions:
        threading.Thread(
            target=_warm_question_variant_batch_worker,
            args=(pending_questions,),
            daemon=True,
        ).start()


def _assemble_questions_from_variant_pool(session_id, blueprint):
    questions = []
    variant_counts = {}
    pool_ready = True

    for source in blueprint:
        if not isinstance(source, dict):
            return None, False, {}

        question_id = str(source.get('id', '')).strip()
        source_hash = _question_source_hash(source)
        variants = [item for item in db_list_question_variants(question_id, source_hash) if isinstance(item, dict)]
        variant_counts[question_id] = len(variants)

        if variants:
            choice_index = _stable_hash(f'{session_id}:{question_id}') % len(variants)
            questions.append(variants[choice_index])
            if len(variants) < QUESTION_VARIANT_TARGET:
                pool_ready = False
        else:
            questions.append(dict(source))
            pool_ready = False

    normalized = normalize_questions(questions, blueprint)
    return normalized, pool_ready, variant_counts


def generate_questions(session_id, blueprint):
    questions, pool_ready, variant_counts = _assemble_questions_from_variant_pool(session_id, blueprint)
    _ensure_question_variant_pool_async(blueprint)

    if questions:
        return questions, None, {'pool_ready': pool_ready, 'variant_counts': variant_counts}

    return None, 'question variant pool assembly failed', {'pool_ready': False, 'variant_counts': variant_counts}


def get_question_pool_status(blueprint):
    status = []
    for question in blueprint:
        question_id = str(question.get('id', '')).strip()
        source_hash = _question_source_hash(question)
        variants = [item for item in db_list_question_variants(question_id, source_hash) if isinstance(item, dict)]
        status.append(
            {
                'question_id': question_id,
                'source_hash': source_hash,
                'count': len(variants),
                'ready': len(variants) >= QUESTION_VARIANT_TARGET,
                'source': question,
                'variants': variants,
            }
        )
    return status


def _merge_variant_into_pool(question, variant):
    question_id = str(question.get('id', '')).strip()
    source_hash = _question_source_hash(question)
    existing = [item for item in db_list_question_variants(question_id, source_hash) if isinstance(item, dict)]
    existing_signatures = {_question_variant_signature(item) for item in existing}
    signature = _question_variant_signature(variant)
    if signature in existing_signatures:
        return len(existing), False

    next_variants = existing + [variant]
    db_replace_question_variants(question_id, source_hash, next_variants[:QUESTION_VARIANT_TARGET])
    return len(next_variants[:QUESTION_VARIANT_TARGET]), True


def warm_question_pool(blueprint, force=False, question_ids=None):
    wanted = set(question_ids or [])
    status_rows = get_question_pool_status(blueprint)
    selected_rows = [row for row in status_rows if not wanted or row['question_id'] in wanted]
    if not selected_rows:
        print('Nothing to warm.')
        return 0

    if force:
        for row in selected_rows:
            db_replace_question_variants(row['question_id'], row['source_hash'], [])

    print(f'Question pool target per question: {QUESTION_VARIANT_TARGET}')
    print(f'Questions selected: {len(selected_rows)}')
    print(f'Warmup mode: full-questionnaire requests x {QUESTION_VARIANT_TARGET}, timeout=180s each')

    failures = 0
    selected_ids = {row['question_id'] for row in selected_rows}

    for round_index in range(QUESTION_VARIANT_TARGET):
        session_id = f'warm-pool-{round_index + 1}-{_now_ts()}'
        print(f'[{round_index + 1}/{QUESTION_VARIANT_TARGET}] Requesting full questionnaire...')
        generated, error = generate_question_set_with_ai(session_id, blueprint, timeout=180)
        if not generated:
            failures += 1
            print(f'  FAILED: {error}')
            continue

        added_count = 0
        for source, variant in zip(blueprint, generated):
            question_id = str(source.get('id', '')).strip()
            if question_id not in selected_ids:
                continue
            _, inserted = _merge_variant_into_pool(source, variant)
            if inserted:
                added_count += 1

        ready_count = 0
        counts = []
        for row in get_question_pool_status(blueprint):
            question_id = row['question_id']
            if question_id not in selected_ids:
                continue
            counts.append(f'{question_id}:{row["count"]}/{QUESTION_VARIANT_TARGET}')
            if row['ready']:
                ready_count += 1

        print(f'  OK: added {added_count} new variants; ready {ready_count}/{len(selected_ids)}')
        print(f'  Pool: {" | ".join(counts)}')

    print(f'Warmup finished. request_failures={failures}')
    return failures


def show_question_pool(blueprint, question_id=None, sample_count=2):
    status_rows = get_question_pool_status(blueprint)
    selected = [row for row in status_rows if not question_id or row['question_id'] == question_id]
    if not selected:
        print('No matching question variants found.')
        return

    ready_count = sum(1 for row in selected if row['ready'])
    print(f'Question pool status: {ready_count}/{len(selected)} ready (target={QUESTION_VARIANT_TARGET})')
    for row in selected:
        print(f'- {row["question_id"]}: {row["count"]}/{QUESTION_VARIANT_TARGET} ready={row["ready"]} hash={row["source_hash"]}')
        for idx, variant in enumerate(row['variants'][:sample_count], start=1):
            scenario = str(variant.get('scenario', '')).strip()
            prompt = str(variant.get('question_text', '')).strip()
            print(f'  [{idx}] {scenario} | {prompt}')


def _repair_report_json_with_ai(raw_text):
    messages = [
        {
            'role': 'system',
            'content': (
                'You fix invalid JSON for a personality report. '
                'Return valid JSON object only with required fields: '
                'headline,surface_persona,core_drives,defense_mechanisms,relationship_pattern,'
                'life_pattern,risks,growth_advice,brutal_summary,shadow_analysis,card_label,'
                'card_shadow_label,card_traits,card_insight. '
                'Types must be strict: defense_mechanisms/risks/growth_advice are arrays of 2 strings, '
                'card_traits is array of 3 strings, brutal_summary <=40 Chinese chars. '
                'Language must be Chinese. Output JSON only.'
            ),
        },
        {'role': 'user', 'content': f'Fix this into valid JSON object only:\n{raw_text}'},
    ]
    payload = call_model(messages, temperature=0.2, top_p=1, timeout=35, max_tokens=1800)
    return extract_content(payload)


def generate_report(scores, main_type, shadow_type, evidence, short_answers):
    prompt = (
        'Write a personality analysis report in Chinese. '
        'Output strict JSON only. No markdown. '
        'Tone: direct, calm, insightful. Do not diagnose mental illness. Do not flatter. '
        'Base every judgment on the provided scores, evidence, and short answers. '
        'Do not invent life history details. '
        'Required fields and types: '
        'headline:string; '
        'brutal_summary:string (<=40 Chinese characters); '
        'surface_persona:string; core_drives:string; '
        'defense_mechanisms:array of 2 strings; '
        'relationship_pattern:string; life_pattern:string; shadow_analysis:string; '
        'risks:array of 2 strings; growth_advice:array of 2 strings; '
        'card_label:string; card_shadow_label:string; '
        'card_traits:array of exactly 3 strings; card_insight:string. '
        'Do not add extra fields. '
        f'Scores: {json.dumps(scores, ensure_ascii=False)} '
        f'MainType: {json.dumps(main_type, ensure_ascii=False)} '
        f'ShadowType: {json.dumps(shadow_type, ensure_ascii=False)} '
        f'Evidence: {json.dumps(evidence, ensure_ascii=False)} '
        f'ShortAnswers: {json.dumps(short_answers, ensure_ascii=False)}'
    )

    messages = [
        {
            'role': 'system',
            'content': (
                'You are a strict JSON report generator. '
                'Output valid JSON only. '
                'No markdown. '
                'Language must be Chinese.'
            ),
        },
        {'role': 'user', 'content': prompt},
    ]

    errors = []
    for i, timeout_sec in enumerate((45, 65), start=1):
        try:
            payload = call_model(messages, temperature=0.75, top_p=0.9, timeout=timeout_sec, max_tokens=1800)
            content = extract_content(payload)
            parsed = safe_json_parse(content, expected='object')
            validated = validate_report_schema(parsed)
            if validated:
                return validated, None

            try:
                repaired_text = _repair_report_json_with_ai(content)
                repaired_parsed = safe_json_parse(repaired_text, expected='object')
                repaired_validated = validate_report_schema(repaired_parsed)
                if repaired_validated:
                    return repaired_validated, None
                errors.append(f'attempt {i}: AI returned invalid report JSON; repair failed')
            except Exception as exc:
                errors.append(f'attempt {i}: AI returned invalid report JSON; repair error: {_format_error("repair failed", exc)}')
        except urllib.error.HTTPError as exc:
            try:
                detail = exc.read().decode('utf-8', errors='ignore').strip()
            except Exception:
                detail = str(exc)
            errors.append(f'attempt {i}: HTTP {exc.code} - {detail or "no response body"}')
        except urllib.error.URLError as exc:
            errors.append(f'attempt {i}: ' + _format_error('Network error', exc))
        except TimeoutError as exc:
            errors.append(f'attempt {i}: ' + _format_error('Model API timeout', exc))
        except socket.timeout as exc:
            errors.append(f'attempt {i}: ' + _format_error('Socket timeout', exc))
        except Exception as exc:
            errors.append(f'attempt {i}: ' + _format_error('Unexpected error', exc))

    return None, ' | '.join(errors) if errors else 'unknown AI report generation error'


def compute_compatibility(source_record, candidate_record):
    source_scores = source_record.get('scores', {})
    candidate_scores = candidate_record.get('scores', {})

    per_dimension = []
    closeness_sum = 0
    alignment_hits = 0
    tension_hits = 0
    for dimension in DIMENSIONS:
        left = int(source_scores.get(dimension, 0))
        right = int(candidate_scores.get(dimension, 0))
        diff = abs(left - right)
        closeness = _clamp(int(round(100 - diff * 0.7)), 0, 100)
        per_dimension.append({'dimension': dimension, 'diff': diff, 'closeness': closeness})
        closeness_sum += closeness
        if diff <= 30:
            alignment_hits += 1
        if diff >= 70:
            tension_hits += 1

    score = round(closeness_sum / len(DIMENSIONS))
    if source_record.get('main_type', {}).get('id') and source_record['main_type'].get('id') == candidate_record.get('main_type', {}).get('id'):
        score += 6
    if source_record.get('shadow_type', {}).get('id') and source_record['shadow_type'].get('id') == candidate_record.get('shadow_type', {}).get('id'):
        score += 4
    score += min(alignment_hits * 2, 8)
    score -= min(tension_hits * 3, 12)
    return _clamp(int(score), 12, 96), per_dimension


def validate_match_schema(payload):
    if not isinstance(payload, dict):
        return None

    def _clean_list(value, expected_length):
        if not isinstance(value, list):
            return None
        items = [str(item).strip() for item in value if str(item).strip()]
        return items[:expected_length] if len(items) >= expected_length else None

    comfortable = _clean_list(payload.get('comfortable_moments'), 2)
    uncomfortable = _clean_list(payload.get('uncomfortable_moments'), 2)
    advice_you = _clean_list(payload.get('advice_for_you'), 2)
    advice_them = _clean_list(payload.get('advice_for_them'), 2)
    if not comfortable or not uncomfortable or not advice_you or not advice_them:
        return None

    comfortable_reason = str(payload.get('comfortable_reason', '')).strip()
    uncomfortable_reason = str(payload.get('uncomfortable_reason', '')).strip()
    what_to_do = str(payload.get('what_to_do', '')).strip()
    if not comfortable_reason or not uncomfortable_reason or not what_to_do:
        return None

    return {
        'summary': str(payload.get('summary', '')).strip(),
        'comfortable_moments': comfortable,
        'comfortable_reason': comfortable_reason,
        'uncomfortable_moments': uncomfortable,
        'uncomfortable_reason': uncomfortable_reason,
        'what_to_do': what_to_do,
        'advice_for_you': advice_you,
        'advice_for_them': advice_them,
        'joint_advice': str(payload.get('joint_advice', '')).strip(),
    }


def _repair_match_json_with_ai(raw_text):
    messages = [
        {
            'role': 'system',
            'content': (
                'You fix invalid JSON for a compatibility report. '
                'Return valid JSON object only with fields: '
                'summary,comfortable_moments,comfortable_reason,uncomfortable_moments,uncomfortable_reason,what_to_do,advice_for_you,advice_for_them,joint_advice. '
                'comfortable_moments/uncomfortable_moments/advice_for_you/advice_for_them must be arrays of 2 Chinese strings. '
                'comfortable_reason/uncomfortable_reason/what_to_do/joint_advice must be Chinese strings. '
                'No markdown. No extra fields.'
            ),
        },
        {'role': 'user', 'content': f'Fix this into valid JSON object only:\n{raw_text}'},
    ]
    payload = call_model(messages, temperature=0.1, top_p=1, timeout=25, max_tokens=1200)
    return extract_content(payload)


def generate_match_report(source_record, candidate_record, compatibility_score, per_dimension):
    prompt = (
        'You are writing an anonymous psychological interaction compatibility report in Chinese. '
        'Output strict JSON only. No markdown. '
        'Do not expose private raw answers or speculate about trauma history. '
        'Describe interaction stages or situations, not exact dates. '
        'Required fields: '
        'summary:string; '
        'comfortable_moments:array of 2 strings; '
        'comfortable_reason:string; '
        'uncomfortable_moments:array of 2 strings; '
        'uncomfortable_reason:string; '
        'what_to_do:string; '
        'advice_for_you:array of 2 strings; '
        'advice_for_them:array of 2 strings; '
        'joint_advice:string. '
        'Focus on how these two styles feel when interacting. '
        f'CompatibilityScore:{compatibility_score} '
        f'YouProfile:{json.dumps({"scores": source_record.get("scores"), "main_type": source_record.get("main_type"), "shadow_type": source_record.get("shadow_type"), "report": source_record.get("report")}, ensure_ascii=False)} '
        f'PartnerProfile:{json.dumps({"scores": candidate_record.get("scores"), "main_type": candidate_record.get("main_type"), "shadow_type": candidate_record.get("shadow_type"), "report": candidate_record.get("report")}, ensure_ascii=False)} '
        f'PerDimension:{json.dumps(per_dimension, ensure_ascii=False)}'
    )

    messages = [
        {
            'role': 'system',
            'content': (
                'You are a strict JSON generator for anonymous compatibility analysis. '
                'Language must be Chinese. '
                'Output valid JSON only.'
            ),
        },
        {'role': 'user', 'content': prompt},
    ]

    errors = []
    for i, timeout_sec in enumerate((35, 50), start=1):
        try:
            payload = call_model(messages, temperature=0.65, top_p=0.9, timeout=timeout_sec, max_tokens=1400)
            content = extract_content(payload)
            parsed = safe_json_parse(content, expected='object')
            validated = validate_match_schema(parsed)
            if validated:
                return validated, None

            repaired = _repair_match_json_with_ai(content)
            repaired_payload = safe_json_parse(repaired, expected='object')
            repaired_validated = validate_match_schema(repaired_payload)
            if repaired_validated:
                return repaired_validated, None
            errors.append(f'attempt {i}: invalid compatibility JSON')
        except urllib.error.HTTPError as exc:
            try:
                detail = exc.read().decode('utf-8', errors='ignore').strip()
            except Exception:
                detail = str(exc)
            errors.append(f'attempt {i}: HTTP {exc.code} - {detail or "no response body"}')
        except urllib.error.URLError as exc:
            errors.append(f'attempt {i}: ' + _format_error('Network error', exc))
        except TimeoutError as exc:
            errors.append(f'attempt {i}: ' + _format_error('Model API timeout', exc))
        except socket.timeout as exc:
            errors.append(f'attempt {i}: ' + _format_error('Socket timeout', exc))
        except Exception as exc:
            errors.append(f'attempt {i}: ' + _format_error('Unexpected error', exc))

    return None, ' | '.join(errors) if errors else 'unknown AI compatibility generation error'


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b'{}'
        return json.loads(body.decode('utf-8'))

    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_bearer_token(self):
        header = self.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        token = header[7:].strip()
        return token or None

    def _get_current_user(self):
        return db_get_user_by_token(self._get_bearer_token())

    def _require_user(self):
        user = self._get_current_user()
        if not user:
            self._send_json(401, {'error': 'Authentication required'})
            return None
        return user

    def _match_record_id(self, path):
        return re.fullmatch(r'/api/records/([^/]+)', path)

    def _match_record_pool_path(self, path):
        return re.fullmatch(r'/api/records/([^/]+)/match-pool', path)

    def _handle_chat_proxy(self, data):
        if not DEBUG_MODE:
            self._send_json(404, {'error': 'Not found'})
            return

        try:
            payload = call_model(data.get('messages', []), temperature=0.8, top_p=0.9, timeout=25, max_tokens=1200)
            self._send_json(200, payload)
        except urllib.error.HTTPError as exc:
            try:
                detail = exc.read().decode('utf-8', errors='ignore')
            except Exception:
                detail = str(exc)
            self._send_json(exc.code, {'error': detail})
        except Exception as exc:
            self._send_json(500, {'error': _format_error('chat proxy failed', exc)})

    def _handle_register(self, data):
        username, error = validate_credentials(data.get('username'), data.get('password'))
        if error:
            self._send_json(400, {'error': error})
            return

        user_row = db_create_user(username, data.get('password'))
        if not user_row:
            self._send_json(409, {'error': 'Username already exists'})
            return

        token = db_create_auth_token(user_row['user_id'])
        self._send_json(200, {'user': sanitize_public_user(user_row), 'token': token})

    def _handle_login(self, data):
        user_row = db_verify_user(data.get('username'), data.get('password'))
        if not user_row:
            self._send_json(401, {'error': 'Invalid username or password'})
            return

        token = db_create_auth_token(user_row['user_id'])
        self._send_json(200, {'user': sanitize_public_user(user_row), 'token': token})

    def _handle_logout(self):
        token = self._get_bearer_token()
        if token:
            db_revoke_auth_token(token)
        self._send_json(200, {'ok': True})

    def _handle_auth_me(self):
        user = self._get_current_user()
        if not user:
            self._send_json(401, {'error': 'Authentication required'})
            return
        self._send_json(200, {'user': user, 'user_stats': db_get_user_stats(user['user_id'])})

    def _handle_stats(self):
        user = self._get_current_user()
        payload = {'global_stats': db_get_global_stats()}
        if user:
            payload['user_stats'] = db_get_user_stats(user['user_id'])
        self._send_json(200, payload)

    def _handle_generate_questions(self, data):
        session_id = data.get('session_id')
        blueprint = data.get('blueprint')

        if not isinstance(session_id, str) or not session_id.strip():
            self._send_json(400, {'error': 'session_id is required'})
            return
        if not isinstance(blueprint, list) or len(blueprint) == 0:
            self._send_json(400, {'error': 'blueprint is required'})
            return

        existing = db_get_session(session_id)
        if isinstance(existing, dict) and isinstance(existing.get('questions'), list):
            self._send_json(200, {'session_id': session_id, 'cached': True, 'questions': existing['questions']})
            return

        questions, error, meta = generate_questions(session_id, blueprint)
        if questions is None:
            self._send_json(502, {'error': f'AI question generation failed: {error}'})
            return

        db_upsert_questions(session_id, questions)
        self._send_json(
            200,
            {
                'session_id': session_id,
                'cached': False,
                'questions': questions,
                'variant_pool_ready': bool(meta.get('pool_ready')),
                'variant_counts': meta.get('variant_counts', {}),
            },
        )

    def _handle_generate_report(self, data):
        session_id = data.get('session_id')
        scores = data.get('scores', {})
        main_type = data.get('main_type', {})
        shadow_type = data.get('shadow_type', {})
        evidence = data.get('evidence', [])
        short_answers = data.get('short_answers', [])

        report, error = generate_report(scores, main_type, shadow_type, evidence, short_answers)
        if report is None:
            self._send_json(502, {'error': f'AI report generation failed: {error}'})
            return

        if isinstance(session_id, str) and session_id.strip():
            db_upsert_report(session_id, report, scores)

        response = {'session_id': session_id, 'report': report}
        user = self._get_current_user()
        if user:
            payload = build_record_payload(data, report_override=report)
            if payload is not None:
                record = db_create_test_record(user['user_id'], payload)
                response['record'] = _record_summary_from_detail(record)

        self._send_json(200, response)

    def _handle_import_record(self, data):
        user = self._require_user()
        if not user:
            return

        payload = build_record_payload(data)
        if payload is None:
            self._send_json(400, {'error': 'Invalid record payload'})
            return

        record = db_create_test_record(user['user_id'], payload)
        self._send_json(200, {'record': _record_summary_from_detail(record)})

    def _handle_list_records(self):
        user = self._require_user()
        if not user:
            return
        self._send_json(200, {'records': db_list_records_for_user(user['user_id'])})

    def _handle_latest_record(self):
        user = self._require_user()
        if not user:
            return
        record = db_get_latest_record_for_user(user['user_id'])
        self._send_json(200, {'record': record})

    def _handle_record_detail(self, record_id):
        user = self._require_user()
        if not user:
            return
        record = db_get_record_for_user(user['user_id'], record_id)
        if not record:
            self._send_json(404, {'error': 'Record not found'})
            return
        self._send_json(200, {'record': record})

    def _handle_record_match_pool(self, record_id, data):
        user = self._require_user()
        if not user:
            return
        enabled = bool(data.get('enabled'))
        record = db_set_match_enabled(user['user_id'], record_id, enabled)
        if not record:
            self._send_json(404, {'error': 'Record not found'})
            return
        self._send_json(200, {'record': _record_summary_from_detail(record)})

    def _handle_random_match(self, data):
        user = self._require_user()
        if not user:
            return

        requested_record_id = data.get('record_id')
        if isinstance(requested_record_id, str) and requested_record_id.strip():
            source_record = db_get_record_for_user(user['user_id'], requested_record_id.strip())
        else:
            source_record = db_get_latest_record_for_user(user['user_id'])

        if not source_record:
            self._send_json(404, {'error': 'No saved record available for matching'})
            return

        candidate = db_get_random_match_candidate(user['user_id'])
        if not candidate:
            self._send_json(404, {'error': 'No opt-in match candidates are available yet'})
            return

        compatibility_score, per_dimension = compute_compatibility(source_record, candidate)
        report, error = generate_match_report(source_record, candidate, compatibility_score, per_dimension)
        if report is None:
            self._send_json(502, {'error': f'AI compatibility generation failed: {error}'})
            return

        match_id = db_save_match_report(
            user['user_id'],
            source_record['record_id'],
            candidate['record_id'],
            compatibility_score,
            report,
        )
        self._send_json(
            200,
            {
                'match': {
                    'match_id': match_id,
                    'compatibility_score': compatibility_score,
                    'report': report,
                    'source': _build_match_profile(source_record),
                    'partner': _build_match_profile(candidate),
                    'source_record_id': source_record['record_id'],
                    'matched_record_id': candidate['record_id'],
                }
            },
        )

    def _handle_version(self):
        self._send_json(
            200,
            {
                'backend_version': BACKEND_VERSION,
                'model': MODEL,
                'debug': DEBUG_MODE,
            },
        )

    def _handle_model_ping(self):
        started = time.time()
        try:
            payload = call_model(
                [
                    {'role': 'system', 'content': 'Reply with JSON only.'},
                    {'role': 'user', 'content': 'Return {"ok":true,"msg":"pong"} in JSON.'},
                ],
                temperature=0,
                top_p=1,
                timeout=12,
                max_tokens=80,
            )
            content = extract_content(payload)
            parsed = safe_json_parse(content, expected='object')
            if not isinstance(parsed, dict):
                raise ValueError('invalid ping JSON')

            self._send_json(200, {'ok': True, 'latency_ms': int((time.time() - started) * 1000), 'model': MODEL})
        except Exception as exc:
            self._send_json(
                502,
                {
                    'ok': False,
                    'latency_ms': int((time.time() - started) * 1000),
                    'error': _format_error('model ping failed', exc),
                    'model': MODEL,
                },
            )

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        record_match = self._match_record_id(path)

        if path == '/api/version':
            self._handle_version()
            return
        if path == '/api/model-ping':
            self._handle_model_ping()
            return
        if path == '/api/stats':
            self._handle_stats()
            return
        if path == '/api/auth/me':
            self._handle_auth_me()
            return
        if path == '/api/records':
            self._handle_list_records()
            return
        if path == '/api/records/latest':
            self._handle_latest_record()
            return
        if record_match:
            self._handle_record_detail(record_match.group(1))
            return

        super().do_GET()

    def do_POST(self):
        try:
            data = self._read_json_body()
        except Exception:
            self._send_json(400, {'error': 'Invalid JSON body'})
            return

        path = urlparse(self.path).path
        record_pool_match = self._match_record_pool_path(path)

        if path == '/api/chat':
            self._handle_chat_proxy(data)
            return
        if path == '/api/auth/register':
            self._handle_register(data)
            return
        if path == '/api/auth/login':
            self._handle_login(data)
            return
        if path == '/api/auth/logout':
            self._handle_logout()
            return
        if path == '/api/generate-questions':
            self._handle_generate_questions(data)
            return
        if path == '/api/generate-report':
            self._handle_generate_report(data)
            return
        if path == '/api/records/import':
            self._handle_import_record(data)
            return
        if record_pool_match:
            self._handle_record_match_pool(record_pool_match.group(1), data)
            return
        if path == '/api/matches/random':
            self._handle_random_match(data)
            return

        self._send_json(404, {'error': 'Not found'})


def run_server():
    if not API_KEY:
        raise RuntimeError('ARK_API_KEY is required')

    print(f'Starting server at http://localhost:{PORT}')
    print(f'DEBUG mode: {DEBUG_MODE}')
    print(f'Session DB: {DB_PATH}')
    print('Press Ctrl+C to stop.')

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socket.setdefaulttimeout(120)

    with socketserver.ThreadingTCPServer(('', PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down server...')
            httpd.shutdown()


def parse_args():
    parser = argparse.ArgumentParser(description='PersonalityMirror backend')
    subparsers = parser.add_subparsers(dest='command')

    subparsers.add_parser('serve', help='Start the HTTP server')

    warm_parser = subparsers.add_parser('warm-question-pool', help='Generate and persist AI question variants')
    warm_parser.add_argument('--blueprint', default=DEFAULT_BLUEPRINT_PATH, help='Path to the question blueprint JSON file')
    warm_parser.add_argument('--force', action='store_true', help='Regenerate variants even if the pool is already full')
    warm_parser.add_argument('--question-id', action='append', dest='question_ids', help='Warm only specific question ids, can repeat')

    show_parser = subparsers.add_parser('show-question-pool', help='Inspect persisted question variants')
    show_parser.add_argument('--blueprint', default=DEFAULT_BLUEPRINT_PATH, help='Path to the question blueprint JSON file')
    show_parser.add_argument('--question-id', help='Show only one question id')
    show_parser.add_argument('--samples', type=int, default=2, help='How many sample variants to print per question')

    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()
    command = args.command or 'serve'

    if command == 'serve':
        run_server()
    elif command == 'warm-question-pool':
        blueprint = load_question_blueprint(args.blueprint)
        failures = warm_question_pool(blueprint, force=args.force, question_ids=args.question_ids)
        raise SystemExit(1 if failures else 0)
    elif command == 'show-question-pool':
        blueprint = load_question_blueprint(args.blueprint)
        show_question_pool(blueprint, question_id=args.question_id, sample_count=max(0, int(args.samples)))
    else:
        raise SystemExit(f'Unknown command: {command}')
