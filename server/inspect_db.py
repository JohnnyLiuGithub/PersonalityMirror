import json
import os
import sqlite3


DB_PATH = os.getenv('SESSION_DB_PATH', os.path.join(os.path.dirname(__file__), 'sessions.db'))
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
