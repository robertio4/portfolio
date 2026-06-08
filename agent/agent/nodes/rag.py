from agent.state import AgentState
from agent.llm.embed import embed_text
from agent.rag.retriever import retrieve
from agent.cache.semantic_cache import semantic_cache


async def rag_node(state: AgentState) -> dict:
    last_user = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"),
        "",
    )

    embedding = await embed_text(last_user)

    cached_answer = semantic_cache.lookup(embedding, state["lang"])
    if cached_answer is not None:
        return {
            "query_embedding": embedding,
            "retrieved_chunks": [],
            "cache_hit": True,
            "answer": cached_answer,
        }

    chunks = retrieve(embedding)
    return {
        "query_embedding": embedding,
        "retrieved_chunks": [
            {"id": c.id, "source": c.source, "text": c.text, "score": c.score}
            for c in chunks
        ],
        "cache_hit": False,
    }
