from __future__ import annotations

import os

from dotenv import load_dotenv
from openai import OpenAI

from config.settings import Settings

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover
    genai = None

load_dotenv()

NVIDIA_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"
NVIDIA_NIM_MODEL = "meta/llama-3.1-8b-instruct"


class LLMClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _call_openai(self, prompt: str) -> str:
        if not self.settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        client = OpenAI(api_key=self.settings.openai_api_key)
        try:
            completion = client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.settings.temperature,
            )
            return completion.choices[0].message.content or ""
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    def _call_gemini(self, prompt: str) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        if genai is None:
            raise RuntimeError("google-generativeai package is not installed")

        try:
            genai.configure(api_key=self.settings.gemini_api_key)
            model = genai.GenerativeModel(self.settings.gemini_model)
            response = model.generate_content(prompt)
            return (response.text or "").strip()
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"Gemini request failed: {exc}") from exc

    def _call_nvidia_nim(self, system_msg: str, user_msg: str) -> str:
        api_key = (os.getenv("NVIDIA_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError("NVIDIA_API_KEY is not set")

        client = OpenAI(
            base_url=NVIDIA_NIM_BASE_URL,
            api_key=api_key,
        )
        try:
            completion = client.chat.completions.create(
                model=NVIDIA_NIM_MODEL,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=self.settings.temperature,
                max_tokens=1500,
            )
            return completion.choices[0].message.content or ""
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"NVIDIA NIM request failed: {exc}") from exc

    def _call_minimax(self, prompt: str) -> str:
        if not self.settings.minimax_api_key:
            raise RuntimeError("MINIMAX_API_KEY is not set")

        client = OpenAI(
            api_key=self.settings.minimax_api_key,
            base_url=self.settings.minimax_base_url,
        )
        try:
            completion = client.chat.completions.create(
                model=self.settings.minimax_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.settings.temperature,
            )
            return completion.choices[0].message.content or ""
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"MiniMax request failed: {exc}") from exc

    async def run(self, system_msg: str, user_msg: str) -> str:
        provider = self.settings.llm_provider.lower().strip()
        # For providers that don't use separate system/user messages,
        # combine them into a single prompt
        combined_prompt = f"{system_msg}\n\n{user_msg}"
        if provider == "openai":
            return self._call_openai(combined_prompt).strip()
        if provider == "gemini":
            return self._call_gemini(combined_prompt).strip()
        if provider == "nvidia":
            return self._call_nvidia_nim(system_msg, user_msg).strip()
        if provider == "minimax":
            return self._call_minimax(combined_prompt).strip()
        raise RuntimeError("Unsupported LLM provider. Use 'openai', 'gemini', 'nvidia', or 'minimax'.")
