from backend.utils.ocr import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_excel,
    extract_text_from_txt,
)
from backend.utils.ner import extract_entities

SUPPORTED_TYPES = {
    ".pdf":  extract_text_from_pdf,
    ".docx": extract_text_from_docx,
    ".doc":  extract_text_from_docx,
    ".xlsx": extract_text_from_excel,
    ".xls":  extract_text_from_excel,
    ".txt":  extract_text_from_txt,
    ".csv":  extract_text_from_txt,
}

def ingest_document(file_bytes: bytes, filename: str) -> dict:
    ext = "." + filename.rsplit(".", 1)[-1].lower()

    if ext not in SUPPORTED_TYPES:
        return {
            "filename": filename,
            "total_pages": 0,
            "chunks": [],
            "summary_entities": {},
            "error": f"Unsupported file type: {ext}. Supported: {', '.join(SUPPORTED_TYPES)}"
        }

    extractor = SUPPORTED_TYPES[ext]
    pages = extractor(file_bytes)

    chunks = []
    all_entities = {"equipment_ids": [], "dates": [], "failure_keywords": []}

    for page in pages:
        entities = extract_entities(page["text"])
        all_entities["equipment_ids"].extend(entities["equipment_ids"])
        all_entities["dates"].extend(entities["dates"])
        all_entities["failure_keywords"].extend(entities["failure_keywords"])
        chunks.append({
            "chunk_id": f"{filename}_page_{page['page']}",
            "filename": filename,
            "page": page["page"],
            "text": page["text"],
            "source": page["source"],
            "entities": entities
        })

    all_entities = {k: list(set(v)) for k, v in all_entities.items()}

    return {
        "filename": filename,
        "total_pages": len(pages),
        "chunks": chunks,
        "summary_entities": all_entities
    }