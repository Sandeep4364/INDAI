from google import genai
import os
import json
from dotenv import load_dotenv
from backend.utils.embeddings import search_index
import time
load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def run_rca(symptom: str) -> dict:
    chunks = search_index(symptom, top_k=5)

    context_parts = []
    sources = []
    for i, chunk in enumerate(chunks):
        label = f"[Source {i+1}: {chunk['filename']} | Page {chunk['page']}]"
        context_parts.append(f"{label}\n{chunk['text']}")
        sources.append({
            "filename": chunk["filename"],
            "page": chunk["page"]
        })

    context = "\n\n".join(context_parts)

    prompt = f"""You are an expert industrial Root Cause Analysis (RCA) engineer.
Analyze the reported symptom using the document context provided.
Return ONLY a valid JSON object — no explanation, no markdown, no code fences.

The JSON must follow this exact structure:
{{
  "symptom": "<the reported symptom>",
  "possible_causes": [
    {{
      "cause": "<cause description>",
      "confidence": <integer 0-100>,
      "evidence": "<which document or finding supports this>",
      "recommendation": "<what action to take>"
    }}
  ],
  "immediate_action": "<single most urgent action to take right now>",
  "severity": "<LOW | MEDIUM | HIGH | CRITICAL>"
}}

Order causes from highest to lowest confidence.
Base everything strictly on the document context below.

CONTEXT:
{context}

SYMPTOM: {symptom}

JSON:"""

    # Retry up to 3 times on server errors
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
        return {
            "symptom": symptom,
            "possible_causes": [],
            "immediate_action": "API unavailable. Please retry.",
            "severity": "UNKNOWN",
            "sources": sources
        }

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "symptom": symptom,
            "possible_causes": [],
            "immediate_action": "Manual inspection required.",
            "severity": "UNKNOWN",
            "raw_response": raw
        }

    result["sources"] = sources
    return result