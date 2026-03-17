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

    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    gemini_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_MODEL")
    ollama_model: str = Field(default="llama3.1", alias="OLLAMA_MODEL")
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")

    temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")

    skills_dir: str = Field(default=str(BASE_DIR / "skills"), alias="SKILLS_DIR")
    log_file: str = Field(default=str(BASE_DIR / "logs" / "agent_runs.log"), alias="LOG_FILE")


@lru_cache
def get_settings() -> Settings:
    return Settings()
