from __future__ import annotations

import time
from typing import Optional

import httpx
from openai import OpenAI

from config.settings import Settings

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover
    genai = None


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

    def _call_ollama(self, prompt: str) -> str:
        base_url = self.settings.ollama_base_url.strip().rstrip("/")
        model = self.settings.ollama_model.strip()

        if not base_url:
            raise RuntimeError("OLLAMA_BASE_URL is not set")
        if not model:
            raise RuntimeError("OLLAMA_MODEL is not set")

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": self.settings.temperature},
        }

        last_error: Optional[Exception] = None
        for attempt in range(3):
            try:
                response = httpx.post(f"{base_url}/api/generate", json=payload, timeout=120)
                response.raise_for_status()
                data = response.json()
                output = (data.get("response") or "").strip()
                if not output:
                    raise RuntimeError("Ollama returned an empty response")
                return output
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code if exc.response is not None else 0
                detail = exc.response.text if exc.response is not None else str(exc)
                last_error = RuntimeError(f"Ollama request failed: {detail}")
                # Retry transient upstream/server errors.
                if attempt < 2 and status_code >= 500:
                    time.sleep(1.2 * (attempt + 1))
                    continue
                raise last_error from exc
            except httpx.HTTPError as exc:
                last_error = RuntimeError(f"Ollama connection failed: {exc}")
                if attempt < 2:
                    time.sleep(1.2 * (attempt + 1))
                    continue
                raise last_error from exc
            except ValueError as exc:
                raise RuntimeError("Ollama returned invalid JSON") from exc

        if last_error is not None:
            raise last_error
        raise RuntimeError("Ollama request failed for an unknown reason")

    async def run(self, prompt: str) -> str:
        provider = self.settings.llm_provider.lower().strip()
        if provider == "openai":
            return self._call_openai(prompt).strip()
        if provider == "gemini":
            return self._call_gemini(prompt).strip()
        if provider == "ollama":
            return self._call_ollama(prompt).strip()
        raise RuntimeError("Unsupported LLM provider. Use 'openai', 'gemini', or 'ollama'.")
