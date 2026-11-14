import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "chessreview.db"


def _connect() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                game_url TEXT PRIMARY KEY,
                player TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def get_analysis(game_url: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT result_json FROM analyses WHERE game_url = ?", (game_url,)
        ).fetchone()
    return json.loads(row[0]) if row else None


def save_analysis(game_url: str, player: str, result: dict) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO analyses (game_url, player, result_json, created_at) "
            "VALUES (?, ?, ?, ?)",
            (
                game_url,
                player,
                json.dumps(result),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
