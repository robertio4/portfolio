import re
import unicodedata

from agent.config import settings
from agent.state import AgentState
from agent.llm.chat import stream_chat

# Deterministic contact-intent guard. The LLM router misclassifies common contact
# paraphrases ("get in touch") as `direct` — despite the prompt listing contact
# info — which skips retrieval entirely and the generator then declines. A contact
# question must reach RAG so the answer is generated from Roberto's (clean) contact
# chunk. We only force the *route* here; the answer is still produced by retrieval +
# generation, never hardcoded. Tuned to contact *intent*: explicit intent stands
# alone, but a bare channel token (his CV lists "LinkedIn, email" as product
# features) only counts when framed as Roberto's / explicitly asked for.
_CHANNEL = r"(email|correo|e-?mail|linkedin|github|telefono|numero|movil|phone)"
_CONTACT_RE = re.compile(
    "|".join(
        [
            r"contactar",
            r"\bcontacto\b",
            r"\bcontact\b(?!\s*cent)",
            r"get in touch",
            r"reach (him|out|roberto)",
            r"how.*(reach|contact)",
            r"como.*(contactar|escrib|hablar|localiz|llegar)",
            rf"(su|sus|his|your|tu|tus)\s+(\w+\s+){{0,2}}{_CHANNEL}",
            rf"(dame|dime|comparte|cual es|cuales son|what'?s|what is|where'?s?|where is)\b.{{0,20}}{_CHANNEL}",
        ]
    )
)


def _is_contact_query(text: str) -> bool:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return bool(_CONTACT_RE.search(t))


ROUTER_SYSTEM = (
    "You are a routing classifier for a portfolio chatbot. "
    "Given the last user message, classify it as one of:\n"
    '- "rag" — if it asks about Roberto: his career, skills, experience, education, '
    "projects, salary, technologies, certifications, languages, professional background, "
    "contact information, email, LinkedIn, location, or anything personal about him.\n"
    '- "direct" — if it is a greeting (hi, hello, hola), a meta-question about the chatbot '
    "(what can you do, who are you), or clearly off-topic (unrelated to Roberto).\n\n"
    "Respond with ONLY the single word: rag  OR  direct"
)

_GROQ_PROVIDER = "groq"
_GROQ_MODEL = "llama-3.1-8b-instant"


def _routing_provider(state: AgentState) -> tuple[str, str]:
    if settings.GROQ_API_KEY:
        return _GROQ_PROVIDER, _GROQ_MODEL
    return state["provider"], state["provider_model_id"]


async def router_node(state: AgentState) -> dict:
    last_user = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"),
        "",
    )

    # Force contact questions into RAG — the LLM router is unreliable on paraphrases.
    if _is_contact_query(last_user):
        return {"route": "rag"}

    provider, model_id = _routing_provider(state)
    full_response = ""
    async for delta in stream_chat(
        provider=provider,
        provider_model_id=model_id,
        system_instruction=ROUTER_SYSTEM,
        messages=[{"role": "user", "content": last_user}],
        max_tokens=5,
        temperature=0.0,
    ):
        full_response += delta

    route = "rag" if "rag" in full_response.lower() else "direct"
    return {"route": route}
