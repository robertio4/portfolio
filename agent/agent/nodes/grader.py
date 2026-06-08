import asyncio

from agent.config import settings
from agent.state import AgentState
from agent.llm.chat import stream_chat

GRADER_SYSTEM = (
    "You are a relevance grader. Given a user question and ONE retrieved passage, "
    "decide if that passage contains information useful to answer the question — "
    "even a single relevant line counts.\n"
    "Respond with ONLY the single word: relevant  OR  not_relevant"
)

_GROQ_PROVIDER = "groq"
_GROQ_MODEL = "llama-3.1-8b-instant"


def _grading_provider(state: AgentState) -> tuple[str, str]:
    if settings.GROQ_API_KEY:
        return _GROQ_PROVIDER, _GROQ_MODEL
    return state["provider"], state["provider_model_id"]


async def _grade_chunk(
    provider: str, model_id: str, question: str, chunk: dict
) -> bool:
    """Grade a single passage. Grading per-chunk (Corrective-RAG style) keeps a
    relevant passage from being drowned out when concatenated with several longer,
    unrelated chunks — the failure mode a small grader model is prone to."""
    full_response = ""
    async for delta in stream_chat(
        provider=provider,
        provider_model_id=model_id,
        system_instruction=GRADER_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Question: {question}\n\nPassage:\n[{chunk['source']}]\n{chunk['text']}",
        }],
        max_tokens=5,
        temperature=0.0,
    ):
        full_response += delta
    return "not_relevant" not in full_response.lower()


async def grader_node(state: AgentState) -> dict:
    chunks = state.get("retrieved_chunks") or []
    if not chunks:
        return {"context_relevant": False}

    last_user = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"),
        "",
    )

    provider, model_id = _grading_provider(state)
    verdicts = await asyncio.gather(
        *(_grade_chunk(provider, model_id, last_user, c) for c in chunks)
    )

    # Keep only the relevant chunks (preserving retrieval order) so the generator
    # receives clean, on-topic context instead of the full noisy top-k set.
    relevant_chunks = [c for c, ok in zip(chunks, verdicts) if ok]
    return {
        "retrieved_chunks": relevant_chunks,
        "context_relevant": len(relevant_chunks) > 0,
    }
