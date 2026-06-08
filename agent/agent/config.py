from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    GOOGLE_API_KEY: str
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    RAG_INDEX_PATH: str = "../api/src/rag/index.json"
    RAG_MIN_SCORE: float = 0.35  # recall floor: descarta solo ruido, no relevancia (eso lo decide el grader)
    RAG_TOP_K: int = 3  # nº de candidatos a graduar; cada uno = 1 llamada LLM al grader
    AGENT_PORT: int = 8788
    LOG_LEVEL: str = "info"


settings = Settings()
