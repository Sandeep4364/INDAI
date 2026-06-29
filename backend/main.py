from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import HTMLResponse

from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(
    title="IndAI",
    description="Industrial Knowledge Intelligence Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ──────────────────────────────────────────
class QuestionRequest(BaseModel):
    question: str


class RCARequest(BaseModel):
    symptom: str


# ── Health ──────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "IndAI is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Ingest ──────────────────────────────────────────────────
@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    allowed = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".csv"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower()

    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed)}",
        )

    from backend.agents.ingestion_agent import ingest_document
    from backend.utils.embeddings import build_index

    file_bytes = await file.read()
    result = ingest_document(file_bytes, file.filename)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    build_index(result["chunks"])

    # Save metadata/chunks into SQLite
    from backend.database import save_document

    save_document(file.filename, file_bytes, result)

    return {
        "message": f"Successfully ingested {file.filename}",
        "pages": result["total_pages"],
        "chunks": len(result["chunks"]),
        "entities": result["summary_entities"],
    }


# ── Copilot ─────────────────────────────────────────────────
@app.post("/ask")
def ask(request: QuestionRequest):
    """Ask a question — returns answer with source citations."""
    from backend.agents.copilot_agent import ask_copilot

    return ask_copilot(request.question)


# ── Chat history routes ─────────────────────────────────────
@app.post("/chat/save")
def save_chat(payload: dict):
    from backend.database import save_chat_message

    save_chat_message(
        payload["session_id"],
        payload["role"],
        payload["text"],
        payload.get("sources", []),
    )
    return {"ok": True}


@app.get("/chat/sessions")
def chat_sessions():
    from backend.database import get_chat_sessions

    return {"sessions": get_chat_sessions()}


@app.get("/chat/sessions/{session_id}")
def chat_session_messages(session_id: str):
    from backend.database import get_chat_messages

    return {"messages": get_chat_messages(session_id)}


@app.delete("/chat/sessions/{session_id}")
def delete_session(session_id: str):
    from backend.database import delete_chat_session

    delete_chat_session(session_id)
    return {"ok": True}


# ── RCA ─────────────────────────────────────────────────────
@app.post("/rca")
def rca(request: RCARequest):
    """Run root cause analysis on a reported symptom."""
    from backend.agents.rca_agent import run_rca

    return run_rca(request.symptom)


# ── Compliance ──────────────────────────────────────────────
@app.get("/compliance")
def compliance():
    """Run compliance check on all ingested documents."""
    from backend.agents.compliance_agent import check_all_documents

    return {"reports": check_all_documents()}


# ── List ingested docs / index management ────────────────
from backend.database import (
    init_db,
    get_all_documents,
    delete_document_db,
    get_db_stats,
)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/documents")
def list_documents():
    docs = get_all_documents()
    stats = get_db_stats()
    return {
        "documents": docs,
        "files": [d["filename"] for d in docs],
        "total_documents": stats["total_documents"],
        "total_chunks": stats["total_chunks"],
        "total_size_kb": stats["total_size_kb"],
    }


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    from backend.utils.embeddings import delete_document as faiss_delete

    faiss_delete(filename)
    db_ok = delete_document_db(filename)
    if not db_ok:
        raise HTTPException(status_code=404, detail=f"{filename} not found.")
    return {"message": f"{filename} removed from index and database."}


@app.get("/search")
def search(
    q: str = "",
    equipment: str = "",
    failure: str = "",
    doc_type: str = "",
    date_from: str = "",
    date_to: str = "",
):
    """Smart search across all indexed documents with filters."""
    import os
    import pickle

    from backend.utils.embeddings import search_index

    if not os.path.exists("vector_store/metadata.pkl"):
        return {"results": [], "total": 0}

    with open("vector_store/metadata.pkl", "rb") as f:
        all_chunks = pickle.load(f)

    # Semantic search if query provided
    if q:
        semantic_results = search_index(q, top_k=20)
        chunks = semantic_results
    else:
        chunks = all_chunks

    # Apply filters
    filtered = []
    for chunk in chunks:
        entities = chunk.get("entities", {})

        if equipment:
            ids = [e.lower() for e in entities.get("equipment_ids", [])]
            if not any(equipment.lower() in i for i in ids):
                continue

        if failure:
            kws = [k.lower() for k in entities.get("failure_keywords", [])]
            if not any(failure.lower() in k for k in kws):
                continue

        if doc_type:
            if doc_type.lower() not in chunk.get("filename", "").lower():
                continue

        # NOTE: date_from/date_to are accepted for API compatibility.
        # If your chunk entities include parsed dates, wire them here.

        filtered.append(
            {
                "filename": chunk["filename"],
                "page": chunk["page"],
                "text": chunk["text"][:400],
                "entities": entities,
                "highlight": q,
            }
        )

    return {"results": filtered[:30], "total": len(filtered)}


@app.post("/graph/build")
def build_graph():
    """Build knowledge graph in Neo4j and regenerate graph HTML."""
    import pickle
    from pathlib import Path

    from knowledge_graph.graph_builder import IndAIGraph
    from knowledge_graph.visualize import generate_html_graph

    metadata_path = Path("vector_store/metadata.pkl")
    if not metadata_path.exists():
        raise HTTPException(status_code=400, detail="No documents ingested yet.")

    with metadata_path.open("rb") as f:
        chunks = pickle.load(f)

    graph = IndAIGraph()
    if not graph.available:
        graph.close()
        raise HTTPException(
            status_code=503,
            detail=(
                "Neo4j is not available. Verify NEO4J_URI, NEO4J_USER, and "
                "NEO4J_PASSWORD in your .env, then restart backend."
            ),
        )

    try:
        graph.clear()
        graph.build_from_chunks(chunks)
    finally:
        graph.close()

    output_path = generate_html_graph("knowledge_graph/graph.html")
    return {
        "message": f"Knowledge graph built in Neo4j from {len(chunks)} chunks.",
        "graph_html": output_path,
    }


@app.get("/alerts")
def get_alerts():
    """Analyze all documents from database and generate predictive alerts + equipment health."""
    from google import genai
    from backend.database import get_all_documents

    import json
    import time

    all_docs = get_all_documents()

    if not all_docs:
        return {"alerts": [], "equipment_health": [], "message": "No documents in database yet."}

    context_parts = []
    equipment_map = {}

    for doc in all_docs:
        eq_ids = doc.get("equipment_ids", [])
        failures = doc.get("failure_keywords", [])
        dates = doc.get("dates", [])

        doc_summary = f"""
Document: {doc['filename']}
Type: {doc['file_type']} | Pages: {doc['pages']} | Uploaded: {doc['uploaded_at']}
Equipment found: {', '.join(eq_ids) if eq_ids else 'None'}
Failure keywords: {', '.join(failures) if failures else 'None'}
Dates found: {', '.join(dates) if dates else 'None'}
"""
        context_parts.append(doc_summary)

        for eq in eq_ids:
            equipment_map.setdefault(eq, [])
            equipment_map[eq].append(
                {
                    "doc": doc["filename"],
                    "failures": failures,
                    "dates": dates,
                    "uploaded": doc["uploaded_at"],
                }
            )

    if os.path.exists("vector_store/metadata.pkl"):
        import pickle

        with open("vector_store/metadata.pkl", "rb") as f:
            chunks = pickle.load(f)
        chunk_text = "\n\n".join(
            f"[{c['filename']} | Page {c['page']}]: {c['text'][:400]}" for c in chunks
        )
    else:
        chunk_text = "No detailed chunk text available."

    context_summary = "\n".join(context_parts)
    equipment_list = "\n".join(
        [
            f"- {eq}: found in {len(all_docs)} document(s), failures: {list(set(f for d in all_docs for f in d['failure_keywords']))}"
            for eq, _docs in equipment_map.items()
        ]
    )

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    prompt = f"""You are an industrial predictive maintenance AI for IndAI.
Analyze ALL the documents listed below and return ONLY valid JSON — no markdown, no explanation.

IMPORTANT: Analyze EVERY document in the list, not just inspection/maintenance reports.
Generate alerts for ANY document that contains equipment IDs, failure keywords, or dates.

Return this exact structure:
{{
  "alerts": [
    {{
      "equipment_id": "<ID>",
      "alert_type": "<OVERDUE_INSPECTION | RECURRING_FAILURE | HIGH_RISK | MAINTENANCE_DUE | COMPLIANCE_GAP>",
      "priority": "<CRITICAL | HIGH | MEDIUM | LOW>",
      "title": "<short alert title>",
      "description": "<what was detected and from which document>",
      "recommended_action": "<what engineer should do>",
      "evidence": "<filename where this was found>"
    }}
  ],
  "equipment_health": [
    {{
      "equipment_id": "<ID>",
      "name": "<descriptive name>",
      "type": "<Pump | Compressor | Boiler | Valve | Other>",
      "health_score": <0-100>,
      "status": "<HEALTHY | WARNING | CRITICAL | UNKNOWN>",
      "last_inspection": "<date or Unknown>",
      "next_inspection_due": "<date or Not specified>",
      "failure_count": <number>,
      "top_risk": "<biggest risk factor>",
      "found_in_documents": ["<list of filenames where this equipment appears>"]
    }}
  ]
}}

Rules:
- health_score: 80-100 = HEALTHY, 50-79 = WARNING, 0-49 = CRITICAL
- Generate one health entry per unique equipment ID
- Generate alerts for ALL equipment with failures or overdue dates
- Reference exact filenames in evidence field
- If a document has equipment but no failures, mark it HEALTHY

INDEXED DOCUMENTS ({len(all_docs)} total):
{context_summary}

EQUIPMENT FOUND ACROSS ALL DOCUMENTS:
{equipment_list}

DOCUMENT CONTENT EXCERPTS:
{chunk_text[:3000]}

JSON:"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            break
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                time.sleep((attempt + 1) * 10)
            else:
                raise e
    else:
        return {"alerts": [], "equipment_health": []}

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        start, end = raw.find("{"), raw.rfind("}") + 1
        result = json.loads(raw[start:end])
        result["total_documents_analyzed"] = len(all_docs)
        result["documents_analyzed"] = [d["filename"] for d in all_docs]
        return result
    except Exception as e:
        return {
            "alerts": [],
            "equipment_health": [],
            "error": f"Parse error: {str(e)}",
            "total_documents_analyzed": len(all_docs),
        }


@app.get("/graph/view", response_class=HTMLResponse)
def view_graph():
    """Return interactive graph HTML."""
    from pathlib import Path

    graph_path = Path("knowledge_graph/graph.html")
    if not graph_path.exists():
        return HTMLResponse(
            "<html><body style='background:#0d1117;color:#e6edf3;font-family:sans-serif;padding:24px'>Build the knowledge graph first.</body></html>"
        )

    with graph_path.open("r", encoding="utf-8") as f:
        return f.read()


@app.get("/graph/data")
def graph_data():
    """Return raw graph data for frontend."""
    from knowledge_graph.graph_builder import IndAIGraph

    g = IndAIGraph()
    data = g.get_graph_data()
    g.close()
    return data

