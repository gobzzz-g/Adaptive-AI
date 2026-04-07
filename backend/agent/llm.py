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


    def _call_ollama(self, system_msg: str, user_msg: str) -> str:
        base_url = self.settings.ollama_base_url.strip().rstrip("/")
        model = self.settings.ollama_model.strip()

        if not base_url:
            raise RuntimeError("OLLAMA_BASE_URL is not set")
        if not model:
            raise RuntimeError("OLLAMA_MODEL is not set")

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            "stream": False,
            "options": {
                "temperature": self.settings.temperature,
                "num_predict": self.settings.ollama_num_predict,
                "top_p": self.settings.ollama_top_p,
            },
        }

        timeout = self.settings.ollama_timeout
        last_error: Optional[Exception] = None
        for attempt in range(2):  # max 1 retry to avoid hanging
            try:
                response = httpx.post(
                    f"{base_url}/api/chat",
                    json=payload,
                    timeout=timeout,
                )
                response.raise_for_status()
                data = response.json()
                output = (
                    (data.get("message") or {}).get("content") or ""
                ).strip()
                if not output:
                    raise RuntimeError("Ollama returned an empty response")
                return output
            except httpx.TimeoutException as exc:
                raise RuntimeError(
                    f"Ollama timed out after {timeout}s. Try a lighter model or increase OLLAMA_TIMEOUT."
                ) from exc
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code if exc.response is not None else 0
                detail = exc.response.text if exc.response is not None else str(exc)
                last_error = RuntimeError(f"Ollama request failed: {detail}")
                if attempt < 1 and status_code >= 500:
                    time.sleep(1.5)
                    continue
                raise last_error from exc
            except httpx.HTTPError as exc:
                last_error = RuntimeError(f"Ollama connection failed: {exc}")
                if attempt < 1:
                    time.sleep(1.5)
                    continue
                raise last_error from exc
            except ValueError as exc:
                raise RuntimeError("Ollama returned invalid JSON") from exc

        if last_error is not None:
            raise last_error
        raise RuntimeError("Ollama request failed for an unknown reason")

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
        if provider == "ollama":
            return self._call_ollama(system_msg, user_msg).strip()
        if provider == "minimax":
            return self._call_minimax(combined_prompt).strip()
        raise RuntimeError("Unsupported LLM provider. Use 'openai', 'gemini', 'ollama', or 'minimax'.")
