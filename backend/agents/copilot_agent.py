from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
from backend.utils.embeddings import search_index

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def ask_copilot(question: str) -> dict:
    chunks = search_index(question, top_k=5)

    if not chunks:
        return {
            "answer": "No documents ingested yet. Please upload documents first.",
            "sources": []
        }

    context_parts = []
    sources = []
    for i, chunk in enumerate(chunks):
        label = f"[Source {i+1}: {chunk['filename']} | Page {chunk['page']}]"
        context_parts.append(f"{label}\n{chunk['text']}")
        sources.append({
            "filename": chunk["filename"],
            "page": chunk["page"],
            "entities": chunk.get("entities", {})
        })

    context = "\n\n".join(context_parts)

    prompt = f"""You are IndAI, an expert industrial knowledge assistant.
Answer the engineer's question using ONLY the provided document context.
Always cite your sources using [Source N] notation.
If the answer is not in the context, say "Information not found in uploaded documents."

CONTEXT:
{context}

QUESTION: {question}

ANSWER (with citations):"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return {
        "answer": response.text,
        "sources": sources
    }