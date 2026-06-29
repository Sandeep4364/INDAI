from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import pickle
import os

MODEL = SentenceTransformer('all-MiniLM-L6-v2')
VECTOR_STORE_PATH = "vector_store/faiss.index"
METADATA_PATH = "vector_store/metadata.pkl"

def embed_texts(texts: list[str]) -> np.ndarray:
    return MODEL.encode(texts, convert_to_numpy=True)

def build_index(chunks: list[dict]):
    """Append new chunks to existing index — never overwrites."""
    os.makedirs("vector_store", exist_ok=True)

    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)

    # Load existing metadata
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, "rb") as f:
            existing_metadata = pickle.load(f)
    else:
        existing_metadata = []

    # Check for duplicate filenames — skip already indexed docs
    existing_files = set(c["filename"] for c in existing_metadata)
    new_chunks = [c for c in chunks if c["filename"] not in existing_files]

    if not new_chunks:
        print(f"Already indexed — skipping.")
        return False  # nothing new added

    new_texts = [c["text"] for c in new_chunks]
    new_embeddings = embed_texts(new_texts)

    if os.path.exists(VECTOR_STORE_PATH):
        # Load and append to existing index
        index = faiss.read_index(VECTOR_STORE_PATH)
        index.add(new_embeddings)
    else:
        # Create fresh index
        dim = new_embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(new_embeddings)

    # Save updated index and metadata
    faiss.write_index(index, VECTOR_STORE_PATH)
    updated_metadata = existing_metadata + new_chunks
    with open(METADATA_PATH, "wb") as f:
        pickle.dump(updated_metadata, f)

    print(f"Added {len(new_chunks)} new chunks. Total: {len(updated_metadata)}")
    return True

def search_index(query: str, top_k: int = 5) -> list[dict]:
    if not os.path.exists(VECTOR_STORE_PATH):
        return []

    index = faiss.read_index(VECTOR_STORE_PATH)
    with open(METADATA_PATH, "rb") as f:
        metadata = pickle.load(f)

    query_vec = embed_texts([query])
    _, indices = index.search(query_vec, top_k)

    results = []
    for i in indices[0]:
        if 0 <= i < len(metadata):
            results.append(metadata[i])
    return results

def get_indexed_files() -> list[str]:
    """Return list of all indexed filenames."""
    if not os.path.exists(METADATA_PATH):
        return []
    with open(METADATA_PATH, "rb") as f:
        metadata = pickle.load(f)
    return list(set(c["filename"] for c in metadata))

def get_index_stats() -> dict:
    """Return stats about the current index."""
    if not os.path.exists(METADATA_PATH):
        return {"total_documents": 0, "total_chunks": 0, "files": []}
    with open(METADATA_PATH, "rb") as f:
        metadata = pickle.load(f)
    files = list(set(c["filename"] for c in metadata))
    return {
        "total_documents": len(files),
        "total_chunks": len(metadata),
        "files": files
    }

def delete_document(filename: str) -> bool:
    """Remove a document from the index."""
    if not os.path.exists(METADATA_PATH):
        return False

    with open(METADATA_PATH, "rb") as f:
        metadata = pickle.load(f)

    filtered = [c for c in metadata if c["filename"] != filename]
    if len(filtered) == len(metadata):
        return False  # file not found

    # Rebuild index without that file
    if filtered:
        texts = [c["text"] for c in filtered]
        embeddings = embed_texts(texts)
        dim = embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(embeddings)
        faiss.write_index(index, VECTOR_STORE_PATH)
    else:
        os.remove(VECTOR_STORE_PATH)

    with open(METADATA_PATH, "wb") as f:
        pickle.dump(filtered, f)

    print(f"Deleted {filename} from index.")
    return True