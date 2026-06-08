import time
from threading import Lock

MAX_TURNS = 10       # conversation turns (user+assistant pairs) to retain
SESSION_TTL = 3600   # seconds (1 hour)


class MemoryStore:
    def __init__(self) -> None:
        self._store: dict[str, dict] = {}
        self._lock = Lock()

    def get(self, session_id: str) -> list[dict]:
        with self._lock:
            entry = self._store.get(session_id)
            if entry is None:
                return []
            if time.time() - entry["last_access"] > SESSION_TTL:
                del self._store[session_id]
                return []
            entry["last_access"] = time.time()
            return list(entry["turns"])

    def append(self, session_id: str, messages: list[dict]) -> None:
        with self._lock:
            entry = self._store.setdefault(
                session_id, {"turns": [], "last_access": time.time()}
            )
            entry["turns"].extend(messages)
            # Keep only the last MAX_TURNS * 2 messages (each turn = user + assistant)
            entry["turns"] = entry["turns"][-(MAX_TURNS * 2):]
            entry["last_access"] = time.time()


memory_store = MemoryStore()
