import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from agent.config import settings
from agent.graph import graph
from agent.memory.store import memory_store
from agent.nodes.generator import generator_stream
from agent.rag.retriever import load_index, index_size
from agent.state import AgentState

logging.basicConfig(level=settings.LOG_LEVEL.upper())
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_index(settings.RAG_INDEX_PATH)
    log.info("RAG index loaded: %d chunks", index_size())
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/chat")
async def chat(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_json"}, status_code=400)

    messages: list[dict] = body.get("messages", [])
    lang: str = body.get("lang", "es")
    session_id: str = body.get("session_id", "anonymous")
    provider: str = body.get("provider", "groq")
    provider_model_id: str = body.get("provider_model_id", "llama-3.1-8b-instant")
    strip_thinking: bool = body.get("strip_thinking", False)

    if not messages:
        return JSONResponse({"error": "no_messages"}, status_code=400)

    # Prepend server-side memory only when the client sends a single message —
    # meaning it has lost its local state (e.g. page refresh). When the client
    # already sends multiple messages it carries the full history, so prepending
    # would duplicate every prior turn and confuse the LLM.
    history = memory_store.get(session_id)
    full_messages = (history + messages) if (history and len(messages) == 1) else messages

    initial_state: AgentState = {
        "messages": full_messages,
        "lang": lang,
        "session_id": session_id,
        "provider": provider,
        "provider_model_id": provider_model_id,
        "strip_thinking": strip_thinking,
        "route": None,
        "query_embedding": None,
        "retrieved_chunks": None,
        "cache_hit": False,
        "answer": None,
        "context_relevant": None,
    }

    try:
        final_state: AgentState = await graph.ainvoke(initial_state)
    except Exception as exc:
        log.error("graph_failed: %s", exc)
        return JSONResponse({"error": "agent_failed"}, status_code=502)

    async def event_stream():
        cache_hit = final_state.get("cache_hit", False)

        if cache_hit:
            answer = final_state.get("answer", "")
            for word in answer.split(" "):
                yield {
                    "event": "delta",
                    "data": json.dumps({"delta": word + " "}),
                }
            yield {"event": "done", "data": json.dumps({"cached": True})}
            memory_store.append(session_id, messages)
            return

        full_answer = ""
        try:
            async for delta in generator_stream(final_state):
                full_answer += delta
                yield {"event": "delta", "data": json.dumps({"delta": delta})}
        except Exception as exc:
            log.error("generator_failed: %s", exc)
            yield {"event": "error", "data": json.dumps({"message": "llm_failed"})}
            return

        yield {"event": "done", "data": json.dumps({"cached": False})}

        # Persist the new turn (user messages + assistant reply) to memory
        new_messages = messages + (
            [{"role": "assistant", "content": full_answer}] if full_answer.strip() else []
        )
        memory_store.append(session_id, new_messages)

    return EventSourceResponse(event_stream())


@app.get("/health")
async def health():
    return {"ok": True, "index_size": index_size()}
