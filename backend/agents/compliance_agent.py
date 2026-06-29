from google import genai
import os
import json
import time
from dotenv import load_dotenv
from backend.utils.embeddings import search_index

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

COMPLIANCE_STANDARDS = {
    "Factory Act 1948": "Section 31 requires boilers to have valid IBR certification and annual inspections.",
    "OISD 116": "Oil Industry Safety Directorate standard for inspection of rotating equipment.",
    "ISO 10816-3": "Vibration severity standard — alarm at 7 mm/s, trip at 11 mm/s for industrial machines.",
    "IBR 1950": "Indian Boiler Regulations — mandatory annual inspection by certified IBR inspector.",
    "PESO": "Petroleum and Explosives Safety Organisation — covers pressure vessels and storage.",
}

def run_compliance_check(document_text: str, filename: str) -> dict:
    standards_context = "\n".join([f"- {k}: {v}" for k, v in COMPLIANCE_STANDARDS.items()])

    prompt = f"""You are an industrial compliance auditor for IndAI.
Review the document and check it against the compliance standards listed below.
Return ONLY a valid JSON object — no explanation, no markdown, no code fences.

COMPLIANCE STANDARDS:
{standards_context}

The JSON must follow this exact structure:
{{
  "document": "<filename>",
  "overall_status": "<COMPLIANT | PARTIALLY_COMPLIANT | NON_COMPLIANT>",
  "compliance_score": <integer 0-100>,
  "findings": [
    {{
      "standard": "<standard name>",
      "status": "<PASS | FAIL | WARNING | NOT_APPLICABLE>",
      "observation": "<what was found in the document>",
      "action_required": "<what needs to be done, or 'None' if PASS>"
    }}
  ],
  "critical_issues": ["<list of urgent issues that need immediate attention>"],
  "next_inspection_due": "<date if mentioned, else 'Not specified'>",
  "auditor_summary": "<2-3 sentence overall summary>"
}}

DOCUMENT ({filename}):
{document_text}

JSON:"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            break
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                wait = (attempt + 1) * 10
                print(f"  Server busy, retrying in {wait}s... (attempt {attempt+1}/3)")
                time.sleep(wait)
            else:
                raise e
    else:
        return {"error": "API unavailable after 3 retries."}

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        # Aggressive cleaning before parsing
        raw = raw.replace("\n", " ")
        # Find first { and last } to extract JSON
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "document": filename,
            "overall_status": "PARSE_ERROR",
            "compliance_score": 0,
            "findings": [],
            "critical_issues": [],
            "next_inspection_due": "Not specified",
            "auditor_summary": "Could not parse response. Please retry.",
            "raw_response": raw
        }



def check_all_documents() -> list[dict]:
    """Run compliance check on all ingested documents."""
    from backend.utils.embeddings import METADATA_PATH
    import pickle

    if not os.path.exists(METADATA_PATH):
        return [{"error": "No documents ingested yet."}]

    with open(METADATA_PATH, "rb") as f:
        chunks = pickle.load(f)

    # Group chunks by filename
    docs = {}
    for chunk in chunks:
        fname = chunk["filename"]
        if fname not in docs:
            docs[fname] = ""
        docs[fname] += chunk["text"] + "\n"

    results = []
    for filename, text in docs.items():
        print(f"  Checking: {filename}...")
        result = run_compliance_check(text, filename)
        results.append(result)
        time.sleep(5)

    return results