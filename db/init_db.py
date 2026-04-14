from pathlib import Path

from db.db import get_connection


def initialize_database() -> None:
    """
    schema.sql을 읽어서 DB 초기화
    """
    base_dir = Path(__file__).resolve().parent
    schema_path = base_dir / "schema.sql"

    if not schema_path.exists():
        raise FileNotFoundError(f"schema.sql not found: {schema_path}")

    schema_sql = schema_path.read_text(encoding="utf-8")

    with get_connection() as conn:
        conn.executescript(schema_sql)
        conn.commit()

    print("Database initialized successfully.")


if __name__ == "__main__":
    initialize_database()