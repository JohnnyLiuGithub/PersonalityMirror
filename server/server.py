import http.server
import json
import os
import re
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
if not API_KEY:
    raise RuntimeError('ARK_API_KEY is required')

API_URL = os.getenv('ARK_API_URL', 'https://ark.cn-beijing.volces.com/api/v3/chat/completions')
MODEL = os.getenv('ARK_MODEL', 'doubao-1-5-pro-32k-250115')
BACKEND_VERSION = '1.0.4'
DEBUG_MODE = os.getenv('DEBUG', '').lower() in {'1', 'true', 'yes', 'on'}
DB_PATH = os.getenv('SESSION_DB_PATH', os.path.join(os.path.dirname(__file__), 'sessions.db'))

ssl_context = ssl.create_default_context()
LIST_SPLIT_RE = re.compile(r'[\n,;，；、]+')
LIST_TRIM_RE = re.compile(r'^[\s\-\d\.\)\(]+|[\s\-\d\.\)\(]+$')


# -----------------------------
# Utility
# -----------------------------
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


def extract_content(chat_payload):
    try:
        return chat_payload['choices'][0]['message']['content']
    except Exception:
        return ''


def call_model(messages, temperature=0.8, top_p=0.9, timeout=30, max_tokens=2200):
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


# -----------------------------
# Persistence (SQLite)
# -----------------------------
DB_LOCK = threading.Lock()
DB_CONN = sqlite3.connect(DB_PATH, check_same_thread=False)
DB_CONN.execute(
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
DB_CONN.commit()


def db_get_session(session_id):
    with DB_LOCK:
        row = DB_CONN.execute(
            'SELECT questions_json, report_json, scores_json FROM sessions WHERE session_id = ?',
            (session_id,),
        ).fetchone()

    if not row:
        return None

    questions_json, report_json, scores_json = row
    return {
        'questions': safe_json_parse(questions_json, expected='array') if questions_json else None,
        'report': safe_json_parse(report_json, expected='object') if report_json else None,
        'scores': safe_json_parse(scores_json, expected='object') if scores_json else None,
    }


def db_upsert_questions(session_id, questions):
    now_ts = int(time.time())
    with DB_LOCK:
        DB_CONN.execute(
            '''
            INSERT INTO sessions(session_id, questions_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id)
            DO UPDATE SET questions_json = excluded.questions_json, updated_at = excluded.updated_at
            ''',
            (session_id, json.dumps(questions, ensure_ascii=False), now_ts),
        )
        DB_CONN.commit()


def db_upsert_report(session_id, report, scores):
    now_ts = int(time.time())
    with DB_LOCK:
        DB_CONN.execute(
            '''
            INSERT INTO sessions(session_id, report_json, scores_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(session_id)
            DO UPDATE SET report_json = excluded.report_json, scores_json = excluded.scores_json, updated_at = excluded.updated_at
            ''',
            (
                session_id,
                json.dumps(report, ensure_ascii=False),
                json.dumps(scores, ensure_ascii=False),
                now_ts,
            ),
        )
        DB_CONN.commit()


# -----------------------------
# Question generation
# -----------------------------
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

    return {
        'theme': theme,
        'items': plan,
    }


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
            merged['answer_hint'] = str(candidate.get('answer_hint', source.get('answer_hint', ''))).strip() or source.get('answer_hint', '')

        output.append(merged)

    return output if len(output) == len(blueprint) else None


def generate_questions(session_id, blueprint):
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

    attempts = [
        {'timeout': 28, 'temperature': 0.95, 'top_p': 0.88, 'max_tokens': 1700},
        {'timeout': 38, 'temperature': 0.85, 'top_p': 0.82, 'max_tokens': 1700},
    ]

    errors = []
    for i, cfg in enumerate(attempts, start=1):
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
            normalized = normalize_questions(parsed, blueprint)
            if normalized:
                return normalized, None
            try:
                repaired_text = _repair_questions_json_with_ai(content, compact_blueprint)
                repaired_parsed = safe_json_parse(repaired_text, expected='array')
                repaired_normalized = normalize_questions(repaired_parsed, blueprint)
                if repaired_normalized:
                    return repaired_normalized, None
                errors.append(f'attempt {i}: AI returned invalid question JSON; repair failed')
            except Exception as exc:
                errors.append(f'attempt {i}: AI returned invalid question JSON; repair error: {_format_error("repair failed", exc)}')
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

    return None, ' | '.join(errors) if errors else 'unknown AI question generation error'


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


# -----------------------------
# Report generation
# -----------------------------
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


# -----------------------------
# HTTP handler
# -----------------------------
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
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

        questions, error = generate_questions(session_id, blueprint)
        if questions is None:
            self._send_json(502, {'error': f'AI question generation failed: {error}'})
            return

        db_upsert_questions(session_id, questions)
        self._send_json(200, {'session_id': session_id, 'cached': False, 'questions': questions})

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

        self._send_json(200, {'session_id': session_id, 'report': report})

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
        path = urlparse(self.path).path.rstrip('/')
        if path == '/api/version':
            self._handle_version()
            return
        if path == '/api/model-ping':
            self._handle_model_ping()
            return
        super().do_GET()

    def do_POST(self):
        try:
            data = self._read_json_body()
        except Exception:
            self._send_json(400, {'error': 'Invalid JSON body'})
            return

        path = urlparse(self.path).path
        if path == '/api/chat':
            self._handle_chat_proxy(data)
            return
        if path == '/api/generate-questions':
            self._handle_generate_questions(data)
            return
        if path == '/api/generate-report':
            self._handle_generate_report(data)
            return

        self._send_json(404, {'error': 'Not found'})


def run_server():
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


if __name__ == '__main__':
    run_server()
