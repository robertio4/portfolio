import json
from pathlib import Path
from typing import NamedTuple

import numpy as np

from agent.config import settings

_chunks: list[dict] = []
_matrix: "np.ndarray | None" = None  # (N, 768) row-normalized


def load_index(path: str) -> None:
    global _chunks, _matrix
    data = json.loads(Path(path).read_text())
    _chunks = data["chunks"]

    vecs = np.array([c["vector"] for c in _chunks], dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    _matrix = vecs / norms


class RetrievedChunk(NamedTuple):
    id: str
    source: str
    text: str
    score: float


def retrieve(query_vec: list[float], k: int | None = None) -> list[RetrievedChunk]:
    if _matrix is None or len(_chunks) == 0:
        return []

    k = settings.RAG_TOP_K if k is None else k

    q = np.array(query_vec, dtype=np.float32)
    norm = np.linalg.norm(q)
    if norm == 0:
        return []
    q_unit = q / norm

    scores = _matrix @ q_unit  # (N,) cosine similarity
    top_indices = np.argsort(scores)[::-1][:k]

    results = []
    for idx in top_indices:
        score = float(scores[idx])
        if score < settings.RAG_MIN_SCORE:
            break
        c = _chunks[idx]
        results.append(RetrievedChunk(c["id"], c["source"], c["text"], score))

    return results


def index_size() -> int:
    return len(_chunks)
