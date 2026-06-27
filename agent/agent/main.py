import json
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from agent.config import settings
from agent.graph import graph
from agent.memory.store import memory_store
from agent.nodes.generator import generator_stream
from agent.rag.retriever import load_index, index_size
from agent.state import AgentState

logging.basicConfig(level=settings.LOG_LEVEL.upper())
log = logging.getLogger(__name__)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)
    lang: Literal["es", "en"] = "es"
    session_id: str = "anonymous"
    provider: str = "groq"
    provider_model_id: str = "llama-3.1-8b-instant"
    strip_thinking: bool = False


class HealthResponse(BaseModel):
    ok: bool
    index_size: int


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_index(settings.RAG_INDEX_PATH)
    log.info("RAG index loaded: %d chunks", index_size())
    yield


app = FastAPI(
    title="Portfolio RAG Agent",
    description="Internal LangGraph agent — router → RAG → grader → generator.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.post("/chat", summary="Stream a chat response via SSE")
async def chat(body: ChatRequest):
    messages = [m.model_dump() for m in body.messages]
    lang = body.lang
    session_id = body.session_id

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
        "provider": body.provider,
        "provider_model_id": body.provider_model_id,
        "strip_thinking": body.strip_thinking,
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


@app.get("/health", response_model=HealthResponse, summary="Health check")
async def health() -> HealthResponse:
    return HealthResponse(ok=True, index_size=index_size())
