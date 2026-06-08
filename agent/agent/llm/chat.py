from typing import AsyncIterator

from agent.config import settings


# ── Groq ──────────────────────────────────────────────────────────────────────

async def _strip_thinking_blocks(source: AsyncIterator[str]) -> AsyncIterator[str]:
    """Port of stripThinkingBlocks from api/src/llm/adapters/groq.ts."""
    in_thinking = False
    buf = ""

    async for chunk in source:
        buf += chunk
        while True:
            if not in_thinking:
                open_idx = buf.find("<think>")
                if open_idx == -1:
                    safe = buf[:-6] if len(buf) > 6 else ""
                    if safe:
                        yield safe
                    buf = buf[len(safe):]
                    break
                if open_idx > 0:
                    yield buf[:open_idx]
                buf = buf[open_idx + 7:]
                in_thinking = True
            else:
                close_idx = buf.find("</think>")
                if close_idx == -1:
                    buf = buf[max(0, len(buf) - 8):]
                    break
                buf = buf[close_idx + 8:]
                in_thinking = False

    if not in_thinking and buf:
        yield buf


async def _stream_groq(
    provider_model_id: str,
    system_instruction: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    strip_thinking: bool,
) -> AsyncIterator[str]:
    from groq import AsyncGroq

    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    chat_messages = [
        {"role": "system", "content": system_instruction},
        *[{"role": m["role"], "content": m["content"]} for m in messages],
    ]
    completion = await client.chat.completions.create(
        model=provider_model_id,
        messages=chat_messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
    )

    async def raw_stream() -> AsyncIterator[str]:
        async for chunk in completion:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta

    source = _strip_thinking_blocks(raw_stream()) if strip_thinking else raw_stream()
    async for delta in source:
        yield delta


# ── Gemini ─────────────────────────────────────────────────────────────────────

async def _stream_gemini(
    provider_model_id: str,
    system_instruction: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
) -> AsyncIterator[str]:
    from google import genai
    from google.genai.types import GenerateContentConfig, Content, Part

    client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    contents = [
        Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[Part(text=m["content"])],
        )
        for m in messages
    ]

    async for chunk in await client.aio.models.generate_content_stream(
        model=provider_model_id,
        contents=contents,
        config=GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
            temperature=temperature,
        ),
    ):
        delta = chunk.text
        if delta:
            yield delta


# ── OpenRouter ─────────────────────────────────────────────────────────────────

async def _stream_openrouter(
    provider_model_id: str,
    system_instruction: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    client = AsyncOpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://robertorgz.dev",
            "X-Title": "Roberto Rodríguez Portfolio",
        },
    )
    chat_messages = [
        {"role": "system", "content": system_instruction},
        *[{"role": m["role"], "content": m["content"]} for m in messages],
    ]
    stream = await client.chat.completions.create(
        model=provider_model_id,
        messages=chat_messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield delta


# ── Public dispatcher ──────────────────────────────────────────────────────────

async def stream_chat(
    provider: str,
    provider_model_id: str,
    system_instruction: str,
    messages: list[dict],
    max_tokens: int = 600,
    temperature: float = 0.4,
    strip_thinking: bool = False,
) -> AsyncIterator[str]:
    if provider == "groq":
        async for delta in _stream_groq(
            provider_model_id, system_instruction, messages, max_tokens, temperature, strip_thinking
        ):
            yield delta
    elif provider == "gemini":
        async for delta in _stream_gemini(
            provider_model_id, system_instruction, messages, max_tokens, temperature
        ):
            yield delta
    elif provider == "openrouter":
        async for delta in _stream_openrouter(
            provider_model_id, system_instruction, messages, max_tokens, temperature
        ):
            yield delta
    else:
        raise ValueError(f"Unknown provider: {provider}")
