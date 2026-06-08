from google import genai
from google.genai.types import EmbedContentConfig

from agent.config import settings

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768  # must match outputDimensionality used during ingest

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _client


async def embed_text(text: str) -> list[float]:
    client = _get_client()
    result = await client.aio.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=EmbedContentConfig(output_dimensionality=EMBED_DIM),
    )
    vec = result.embeddings[0].values
    if not vec:
        raise RuntimeError("Embedding API returned empty vector")
    return list(vec)
