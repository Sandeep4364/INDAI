import sqlite3
import json
from datetime import datetime

DB_PATH = "indai.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT UNIQUE NOT NULL,
            file_type   TEXT,
            pages       INTEGER DEFAULT 0,
            chunks      INTEGER DEFAULT 0,
            equipment_ids TEXT DEFAULT '[]',
            dates         TEXT DEFAULT '[]',
            failure_keywords TEXT DEFAULT '[]',
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            file_size_kb REAL DEFAULT 0
        )
    """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER,
            chunk_index INTEGER,
            page        INTEGER,
            text        TEXT,
            FOREIGN KEY (document_id) REFERENCES documents(id)
        )
    """
    )
    conn.commit()
    conn.close()
    print("Database initialized.")


def save_document(filename: str, file_bytes: bytes, result: dict):
    """Save document metadata and chunks to SQLite."""
    conn = get_connection()
    entities = result.get("summary_entities", {})
    ext = filename.rsplit(".", 1)[-1].lower()

    # Merge entities from all chunks for richer metadata
    all_equipment = set(entities.get("equipment_ids", []))
    all_dates = set(entities.get("dates", []))
    all_failures = set(entities.get("failure_keywords", []))

    for chunk in result.get("chunks", []):
        chunk_entities = chunk.get("entities", {})
        all_equipment.update(chunk_entities.get("equipment_ids", []))
        all_dates.update(chunk_entities.get("dates", []))
        all_failures.update(chunk_entities.get("failure_keywords", []))

    try:
        cursor = conn.execute(
            """
            INSERT OR REPLACE INTO documents
            (filename, file_type, pages, chunks, equipment_ids, dates, failure_keywords, uploaded_at, file_size_kb)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                filename,
                ext,
                result.get("total_pages", 0),
                len(result.get("chunks", [])),
                json.dumps(list(all_equipment)),
                json.dumps(list(all_dates)),
                json.dumps(list(all_failures)),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                round(len(file_bytes) / 1024, 2),
            ),
        )
        doc_id = cursor.lastrowid

        conn.execute("DELETE FROM chunks WHERE document_id = ?", (doc_id,))
        for i, chunk in enumerate(result.get("chunks", [])):
            conn.execute(
                """
                INSERT INTO chunks (document_id, chunk_index, page, text)
                VALUES (?, ?, ?, ?)
            """,
                (doc_id, i, chunk.get("page", 1), chunk.get("text", "")),
            )

        conn.commit()
        print(f"Saved {filename} to database with {len(all_equipment)} equipment IDs.")
    finally:
        conn.close()


def get_all_documents() -> list[dict]:
    """Return all documents with metadata."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, filename, file_type, pages, chunks,
               equipment_ids, dates, failure_keywords,
               uploaded_at, file_size_kb
        FROM documents ORDER BY uploaded_at DESC
    """
    ).fetchall()
    conn.close()

    docs = []
    for row in rows:
        docs.append(
            {
                "id": row["id"],
                "filename": row["filename"],
                "file_type": row["file_type"],
                "pages": row["pages"],
                "chunks": row["chunks"],
                "equipment_ids": json.loads(row["equipment_ids"]),
                "dates": json.loads(row["dates"]),
                "failure_keywords": json.loads(row["failure_keywords"]),
                "uploaded_at": row["uploaded_at"],
                "file_size_kb": row["file_size_kb"],
            }
        )
    return docs


def get_document(filename: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM documents WHERE filename = ?", (filename,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)


def delete_document_db(filename: str) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM documents WHERE filename = ?", (filename,)
    ).fetchone()
    if not row:
        conn.close()
        return False
    conn.execute("DELETE FROM chunks WHERE document_id = ?", (row["id"],))
    conn.execute("DELETE FROM documents WHERE filename = ?", (filename,))
    conn.commit()
    conn.close()
    return True


def get_db_stats() -> dict:
    conn = get_connection()
    total_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    total_chunks = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    total_size = conn.execute("SELECT SUM(file_size_kb) FROM documents").fetchone()[0] or 0
    conn.close()
    return {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "total_size_kb": round(total_size, 2),
    }


def save_chat_message(session_id: str, role: str, text: str, sources: list = None):
    """Save a chat message to database."""
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT NOT NULL,
            role        TEXT NOT NULL,
            text        TEXT NOT NULL,
            sources     TEXT DEFAULT '[]',
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        INSERT INTO chat_history (session_id, role, text, sources)
        VALUES (?, ?, ?, ?)
        """,
        (session_id, role, text, json.dumps(sources or [])),
    )
    conn.commit()
    conn.close()


def get_chat_sessions() -> list[dict]:
    """Return all unique chat sessions with preview."""
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            sources TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    rows = conn.execute(
        """
        SELECT
            session_id,
            MIN(created_at) as started_at,
            MAX(created_at) as last_at,
            COUNT(*) as message_count,
            MIN(CASE WHEN role='user' THEN text END) as first_question
        FROM chat_history
        GROUP BY session_id
        ORDER BY last_at DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_chat_messages(session_id: str) -> list[dict]:
    """Return all messages for a session."""
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            sources TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    rows = conn.execute(
        """
        SELECT role, text, sources, created_at
        FROM chat_history
        WHERE session_id = ?
        ORDER BY created_at ASC
        """,
        (session_id,),
    ).fetchall()
    conn.close()
    return [
        {
            "role": r["role"],
            "text": r["text"],
            "sources": json.loads(r["sources"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def delete_chat_session(session_id: str):
    """Delete all messages in a session."""
    conn = get_connection()
    conn.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()

