from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    minimax_api_key: str = Field(default="", alias="MINIMAX_API_KEY")

    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    gemini_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_MODEL")
    ollama_model: str = Field(default="llama3.1", alias="OLLAMA_MODEL")
    minimax_model: str = Field(default="MiniMax-M2.5", alias="MINIMAX_MODEL")
    minimax_base_url: str = Field(default="https://api.minimax.io/v1", alias="MINIMAX_BASE_URL")
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")

    temperature: float = Field(default=0.3, alias="LLM_TEMPERATURE")
    ollama_num_predict: int = Field(default=250, alias="OLLAMA_NUM_PREDICT")
    ollama_top_p: float = Field(default=0.9, alias="OLLAMA_TOP_P")
    ollama_timeout: int = Field(default=10, alias="OLLAMA_TIMEOUT")

    skills_dir: str = Field(default=str(BASE_DIR / "skills"), alias="SKILLS_DIR")
    log_file: str = Field(default=str(BASE_DIR / "logs" / "agent_runs.log"), alias="LOG_FILE")


@lru_cache
def get_settings() -> Settings:
    return Settings()
