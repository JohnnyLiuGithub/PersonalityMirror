import json
import os
import sqlite3


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')


def load_env_file(path):
    values = {}
    if not os.path.exists(path):
        return values
    with open(path, 'r', encoding='utf-8') as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip()
    return values


ENV_FILE_VALUES = load_env_file(ENV_PATH)
DB_PATH = os.getenv(
    'SESSION_DB_PATH',
    ENV_FILE_VALUES.get('SESSION_DB_PATH', os.path.join(os.path.dirname(__file__), 'sessions.db')),
)
TABLES = [
    'sessions',
    'users',
    'auth_tokens',
    'test_records',
    'match_reports',
    'question_variants',
]


def fetch_scalar(conn, sql, params=()):
    row = conn.execute(sql, params).fetchone()
    return None if row is None else row[0]


def table_exists(conn, table_name):
    return (
        fetch_scalar(
            conn,
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        )
        is not None
    )


def table_columns(conn, table_name):
    return [
        {
            'name': row[1],
            'type': row[2],
            'notnull': bool(row[3]),
            'default': row[4],
            'pk': bool(row[5]),
        }
        for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()
    ]


def main():
    conn = sqlite3.connect(DB_PATH)
    summary = {
        'db_path': DB_PATH,
        'db_exists': os.path.exists(DB_PATH),
        'db_size_bytes': os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0,
        'tables': {},
    }

    for table_name in TABLES:
        if not table_exists(conn, table_name):
            summary['tables'][table_name] = {'exists': False}
            continue
        summary['tables'][table_name] = {
            'exists': True,
            'row_count': int(fetch_scalar(conn, f'SELECT COUNT(*) FROM {table_name}') or 0),
            'columns': table_columns(conn, table_name),
        }

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
