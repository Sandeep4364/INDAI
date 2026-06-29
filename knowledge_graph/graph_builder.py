import sqlite3
import os

DB_PATH = "knowledge_graph/graph.db"


def get_connection():
    os.makedirs("knowledge_graph", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_graph_db():
    conn = get_connection()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS nodes (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            name  TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS edges (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id  INTEGER NOT NULL,
            target_id  INTEGER NOT NULL,
            rel_type   TEXT NOT NULL,
            FOREIGN KEY (source_id) REFERENCES nodes(id),
            FOREIGN KEY (target_id) REFERENCES nodes(id)
        );
        """
    )
    conn.commit()
    conn.close()


class IndAIGraph:
    def __init__(self):
        self.available = True
        init_graph_db()
        print("Local SQLite graph initialized.")

    def close(self):
        pass  # no persistent connection needed

    def clear(self):
        conn = get_connection()
        conn.executescript("DELETE FROM edges; DELETE FROM nodes;")
        conn.commit()
        conn.close()
        print("Graph cleared.")

    def _merge_node(self, conn, label: str, name: str) -> int:
        row = conn.execute("SELECT id FROM nodes WHERE name = ?", (name,)).fetchone()
        if row:
            return row["id"]

        cur = conn.execute(
            "INSERT INTO nodes (label, name) VALUES (?, ?)", (label, name)
        )
        conn.commit()
        return cur.lastrowid

    def _merge_edge(self, conn, source_id: int, target_id: int, rel_type: str):
        exists = conn.execute(
            """
            SELECT id FROM edges
            WHERE source_id=? AND target_id=? AND rel_type=?
            """,
            (source_id, target_id, rel_type),
        ).fetchone()

        if not exists:
            conn.execute(
                "INSERT INTO edges (source_id, target_id, rel_type) VALUES (?,?,?)",
                (source_id, target_id, rel_type),
            )
            conn.commit()

    def build_from_chunks(self, chunks: list[dict]):
        conn = get_connection()
        for chunk in chunks:
            filename = chunk["filename"]
            entities = chunk["entities"]

            doc_id = self._merge_node(conn, "Document", filename)

            for eq_id in entities.get("equipment_ids", []):
                eq_node_id = self._merge_node(conn, "Equipment", eq_id)
                self._merge_edge(conn, doc_id, eq_node_id, "MENTIONS")

                for kw in entities.get("failure_keywords", []):
                    fail_id = self._merge_node(conn, "Failure", kw)
                    self._merge_edge(eq_node_id, fail_id, "HAS_FAILURE")

            for date in entities.get("dates", []):
                date_id = self._merge_node(conn, "Date", date)
                self._merge_edge(conn, doc_id, date_id, "RECORDED_ON")

        conn.close()
        print(f"Graph built from {len(chunks)} chunks.")

    def get_equipment_history(self, equipment_id: str) -> list[dict]:
        conn = get_connection()
        rows = conn.execute(
            """
            SELECT n2.name as failure
            FROM nodes n1
            JOIN edges e ON e.source_id = n1.id
            JOIN nodes n2 ON n2.id = e.target_id
            WHERE n1.name = ? AND e.rel_type = 'HAS_FAILURE'
            """,
            (equipment_id,),
        ).fetchall()
        conn.close()
        return [{"equipment": equipment_id, "failure": r["failure"]} for r in rows]

    def get_graph_data(self) -> dict:
        conn = get_connection()
        nodes = [dict(r) for r in conn.execute("SELECT * FROM nodes").fetchall()]
        edges = [dict(r) for r in conn.execute("SELECT * FROM edges").fetchall()]
        conn.close()

        # Keep same shape expected by existing frontend (graph html uses this elsewhere)
        return {
            "nodes": [
                {
                    "_id": n["id"],
                    "_label": n["label"],
                    "name": n["name"],
                    "id": n["name"],
                }
                for n in nodes
            ],
            "relationships": [
                {
                    "source": e["source_id"],
                    "target": e["target_id"],
                    "type": e["rel_type"],
                }
                for e in edges
            ],
        }

