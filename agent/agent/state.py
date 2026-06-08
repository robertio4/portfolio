from typing import TypedDict, Literal


class AgentState(TypedDict):
    # ── Inputs set once by the entry point ────────────────────────────
    messages: list[dict]        # [{role: 'user'|'assistant', content: str}]
    lang: str                   # 'es' | 'en'
    session_id: str             # ip_hash forwarded from Hono
    provider: str               # 'groq' | 'gemini' | 'openrouter'
    provider_model_id: str      # e.g. 'llama-3.1-8b-instant'
    strip_thinking: bool

    # ── Set by Router node ─────────────────────────────────────────────
    route: Literal["rag", "direct", "contact"] | None

    # ── Set by RAG node ────────────────────────────────────────────────
    query_embedding: list[float] | None
    retrieved_chunks: list[dict] | None   # [{id, source, text, score}]
    cache_hit: bool
    answer: str | None                    # populated only on cache hit

    # ── Set by Grader node ─────────────────────────────────────────────
    context_relevant: bool | None
