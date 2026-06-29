# IndAI — Industrial Knowledge Intelligence Platform

> AI-powered platform that converts scattered industrial documents into a unified, queryable intelligence layer.

---

## Problem Statement

Industrial engineers spend **35% of their time searching for information** across disconnected systems — maintenance reports, SOPs, inspection records, OEM manuals, and audit logs. When experienced employees retire, years of knowledge disappear.

**IndAI solves this** by ingesting all industrial documents and making them instantly queryable through an AI copilot, root cause analysis engine, compliance auditor, and visual knowledge graph.

---

## Features

### 📂 Universal Document Ingestion
- Accepts PDF, DOCX, Excel, TXT, CSV
- Extracts text, equipment IDs, failure keywords, and dates
- Builds a searchable FAISS vector index

### 💬 Industrial Copilot (RAG)
- Ask natural language questions about your documents
- Answers with source citations (filename + page number)
- Powered by Gemini 2.5 Flash + Sentence Transformers

### 🔍 Root Cause Analysis Agent
- Input a failure symptom → get ranked probable causes
- Each cause has a confidence score (0–100%) and evidence from documents
- Severity classification: LOW / MEDIUM / HIGH / CRITICAL

### 💬 Chat History & Session Memory 💾
- Copilot Chat auto-saves every message to SQLite (`indai.db`) using a `session_id`
- History tab lets you browse sessions, reload full conversations, and delete sessions
- Backend endpoints: `/chat/save`, `/chat/sessions`, `/chat/sessions/{session_id}`

### 🕸️ Knowledge Graph
- Visual graph of Equipment → Failures → Documents → Dates
- Built on Neo4j Aura (cloud)
- Interactive, draggable visualization via Pyvis

### 📋 Compliance Audit Agent
- Checks documents against Factory Act 1948, OISD 116, ISO 10816-3, IBR 1950, PESO
- Compliance score per document (0–100)
- Flags critical issues and required actions


---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite |
| Backend | FastAPI (Python) |
| LLM | Gemini 2.5 Flash |
| Embeddings | Sentence Transformers (all-MiniLM-L6-v2) |
| Vector DB | FAISS |
| Graph DB | Neo4j Aura |
| Document parsing | PyMuPDF, python-docx, openpyxl |
| Package manager | uv |

---

## Project Structure

```
IndAI/
├── main.py                     # Entry script
├── pyproject.toml              # Python dependencies and metadata (uv)
├── uv.lock                     # Locked Python dependency versions
├── TODO.md                     # Task backlog / notes
├── test_all.py                 # Combined test runner
├── test_ingestion.py           # Ingestion tests
├── test_rag.py                 # Copilot/RAG tests
├── test_rca.py                 # RCA tests
├── test_graph.py               # Knowledge graph tests
├── test_compliance.py          # Compliance tests
├── test_voice.html             # Voice UI test page
├── backend/
│   ├── main.py                  # FastAPI app — all API routes
│   ├── database.py              # SQLite persistence (documents/chat)
│   ├── agents/
│   │   ├── ingestion_agent.py   # Document parsing pipeline
│   │   ├── copilot_agent.py     # RAG Q&A with citations
│   │   ├── rca_agent.py         # Root cause analysis
│   │   └── compliance_agent.py  # Compliance checker
│   └── utils/
│       ├── ocr.py               # Multi-format text extraction
│       ├── ner.py               # Entity extraction (equipment IDs, dates)
│       └── embeddings.py        # FAISS vector store
├── knowledge_graph/
│   ├── graph_builder.py         # Neo4j graph construction
│   └── visualize.py             # Pyvis HTML generation
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/
│           ├── Sidebar.jsx
│           ├── SmartSearch.jsx
│           ├── AlertsHealth.jsx
│           ├── UploadPanel.jsx
│           ├── ChatInterface.jsx
│           ├── RCADashboard.jsx
│           ├── GraphViewer.jsx
│           └── ComplianceDash.jsx
├── docs/                        # Project documentation
├── lib/                         # Static JS/CSS libs for graph pages
├── datasets/                    # Sample industrial PDFs
├── vector_store/                # FAISS index (auto-generated)
├── indai.db                     # SQLite app database (runtime)
└── .env                         # API keys (not committed)
```

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- uv package manager
- Neo4j Aura free account
- Google Gemini API key (free at aistudio.google.com)

### 1. Clone and install
```bash
git clone https://github.com/yourusername/IndAI.git
cd IndAI
uv venv && .venv\Scripts\activate
uv add fastapi uvicorn pymupdf pytesseract spacy sentence-transformers faiss-cpu google-genai neo4j pyvis python-multipart python-dotenv python-docx openpyxl
uv run python -m spacy download en_core_web_sm
```

### 2. Configure environment
```bash
# Create .env file
GEMINI_API_KEY=your_gemini_api_key
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

### 3. Start backend
```bash
uv run uvicorn backend.main:app --reload
# API runs at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### 4. Start frontend
```bash
cd frontend
npm install
npm run dev
# UI runs at http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/ingest` | Upload and index a document |
| POST | `/ask` | Ask the industrial copilot |
| POST | `/rca` | Run root cause analysis |
| GET | `/compliance` | Run compliance audit |
| POST | `/graph/build` | Build knowledge graph |
| GET | `/graph/view` | Interactive graph HTML |
| GET | `/documents` | List indexed documents |

---

## Sample Queries

After uploading the sample PDFs from `datasets/`:

**Copilot:**
- *"Why did Pump P-101 fail?"*
- *"What were the inspection findings for Compressor C-201?"*
- *"What compliance standards apply to Boiler B-202?"*

**RCA Agent:**
- *"Pump P-101 showing high vibration alarm"*
- *"Compressor C-201 discharge temperature exceeding limit"*

---

## Built for

ET AI Hackathon 2026 — Problem 8: AI for Industrial Knowledge Intelligence
# INDAI
