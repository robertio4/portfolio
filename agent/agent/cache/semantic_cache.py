import time
from collections import OrderedDict
from threading import Lock

import numpy as np

MAX_ENTRIES = 100
TTL_SECONDS = 86400        # 24 hours
SIMILARITY_THRESHOLD = 0.92


class SemanticCache:
    def __init__(self) -> None:
        self._entries: OrderedDict[int, dict] = OrderedDict()
        self._lock = Lock()
        self._counter = 0

    def lookup(self, query_emb: list[float], lang: str) -> str | None:
        now = time.time()
        q = np.array(query_emb, dtype=np.float32)
        q_norm = np.linalg.norm(q)
        if q_norm == 0:
            return None

        with self._lock:
            best_score = -1.0
            best_answer: str | None = None
            for entry in self._entries.values():
                if now - entry["ts"] > TTL_SECONDS:
                    continue
                if entry["lang"] != lang:
                    continue
                e = np.array(entry["embedding"], dtype=np.float32)
                e_norm = np.linalg.norm(e)
                if e_norm == 0:
                    continue
                score = float(np.dot(q, e) / (q_norm * e_norm))
                if score > best_score:
                    best_score = score
                    best_answer = entry["answer"]

        if best_score >= SIMILARITY_THRESHOLD:
            return best_answer
        return None

    def store(self, embedding: list[float], question: str, answer: str, lang: str) -> None:
        with self._lock:
            self._counter += 1
            self._entries[self._counter] = {
                "embedding": embedding,
                "question": question,
                "answer": answer,
                "ts": time.time(),
                "lang": lang,
            }
            while len(self._entries) > MAX_ENTRIES:
                self._entries.popitem(last=False)  # evict oldest (LRU)

    def size(self) -> int:
        return len(self._entries)


semantic_cache = SemanticCache()
