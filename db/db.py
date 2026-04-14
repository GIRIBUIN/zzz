import sqlite3
from pathlib import Path
from typing import Any, Iterable, Optional

from config import DB_PATH


def get_connection() -> sqlite3.Connection:
    """
    SQLite 연결 생성
    Row를 dict처럼 다루기 위해 row_factory 설정
    """
    db_path = Path(DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def execute(query: str, params: Optional[Iterable[Any]] = None) -> None:
    """
    INSERT / UPDATE / DELETE 등 단일 쿼리 실행
    """
    with get_connection() as conn:
        conn.execute(query, params or [])
        conn.commit()


def executemany(query: str, params_list: Iterable[Iterable[Any]]) -> None:
    """
    여러 row를 한 번에 INSERT 할 때 사용
    """
    with get_connection() as conn:
        conn.executemany(query, params_list)
        conn.commit()


def fetch_one(query: str, params: Optional[Iterable[Any]] = None) -> Optional[dict]:
    """
    SELECT 결과 1건 조회
    """
    with get_connection() as conn:
        row = conn.execute(query, params or []).fetchone()
        return dict(row) if row else None


def fetch_all(query: str, params: Optional[Iterable[Any]] = None) -> list[dict]:
    """
    SELECT 결과 전체 조회
    """
    with get_connection() as conn:
        rows = conn.execute(query, params or []).fetchall()
        return [dict(row) for row in rows]