import os
import time
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

GEMINI_BASE_URL = os.environ.get(
    "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Flash models are the ones covered by Gemini's free tier (Pro is heavily
# rate-limited on free/not free at all depending on the moment) - Flash is
# still strong for HTML/CSS/JS generation, so it's the right default here.
CODE_MODEL = os.environ.get("GEMINI_CODE_MODEL", "gemini-2.5-flash")
REASONING_MODEL = os.environ.get("GEMINI_REASONING_MODEL", "gemini-2.5-flash")

CODE_MODEL_FALLBACKS = [CODE_MODEL, "gemini-2.0-flash"]
REASONING_MODEL_FALLBACKS = [REASONING_MODEL, "gemini-2.0-flash"]


class GeminiClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or GEMINI_API_KEY
        if not self.api_key:
            raise RuntimeError(
                "GEMINI_API_KEY missing. Get a free key at "
                "https://aistudio.google.com/apikey and set it in your .env file."
            )
        self.session = requests.Session()
        # NOTE: total=0 is deliberate. Our own chat() loop below already does
        # backoff + same-model retry + cross-model fallback with knowledge of
        # WHY a call failed (503 overload vs 429 quota vs 404). If urllib3 also
        # retries at the transport level and then exhausts ITS OWN retries, it
        # raises an opaque requests.exceptions.RetryError that skips our logic
        # entirely and crashes the pipeline. Letting every failure surface
        # immediately to chat() keeps a single, smarter retry authority.
        retry_strategy = Retry(total=0)
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def _chat_once(self, system_prompt: str, user_prompt: str, model: str,
                    temperature: float, max_tokens: int, timeout: int = 180) -> str:
        url = f"{GEMINI_BASE_URL}/models/{model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        resp = self.session.post(url, json=payload, timeout=timeout)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini API error {resp.status_code}: {resp.text[:500]}")
        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise RuntimeError(f"Gemini returned no candidates: {data}")
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)

    def chat(self, system_prompt: str, user_prompt: str, model: str = None,
              temperature: float = 0.4, max_tokens: int = 16000,
              fallbacks: list = None, timeout: int = 180,
              max_timeout_retries: int = 3) -> str:
        candidates = [model] if model else []
        if fallbacks:
            candidates += [m for m in fallbacks if m not in candidates]
        if not candidates:
            candidates = [REASONING_MODEL]

        last_error = None
        for candidate_model in candidates:
            timeout_retries = 0
            current_timeout = timeout
            while timeout_retries <= max_timeout_retries:
                attempt_num = timeout_retries + 1
                try:
                    print(f"[GeminiClient] Trying '{candidate_model}' "
                          f"(attempt {attempt_num}, timeout={current_timeout}s)...")
                    result = self._chat_once(
                        system_prompt, user_prompt, candidate_model,
                        temperature, max_tokens, current_timeout,
                    )
                    print(f"[GeminiClient]  Succeeded using model '{candidate_model}'.")
                    return result
                except requests.exceptions.RequestException as e:
                    # Catches ReadTimeout, ConnectionError, RetryError, and any
                    # other transport-level failure - not just the two we
                    # originally special-cased, which is what let a wrapped
                    # 503 (RetryError from urllib3) slip past uncaught before.
                    last_error = e
                    timeout_retries += 1
                    if timeout_retries <= max_timeout_retries:
                        backoff_time = 2 ** (timeout_retries - 1)
                        current_timeout = min(timeout * (1.5 ** timeout_retries), 300)
                        print(f"[GeminiClient]  Transport error on '{candidate_model}' "
                              f"({type(e).__name__}), waiting {backoff_time}s, "
                              f"retrying with {current_timeout}s...")
                        time.sleep(backoff_time)
                    else:
                        print(f"[GeminiClient]  Max retries exceeded for '{candidate_model}', "
                              f"trying next fallback...")
                        break
                except RuntimeError as e:
                    msg = str(e)
                    last_error = e
                    if "503" in msg or "UNAVAILABLE" in msg:
                        # Transient "model overloaded" - worth a same-model
                        # backoff retry before giving up on it entirely.
                        timeout_retries += 1
                        if timeout_retries <= max_timeout_retries:
                            backoff_time = 2 ** timeout_retries  # 2s, 4s, 8s
                            print(f"[GeminiClient]  503 overloaded on '{candidate_model}' "
                                  f"(attempt {attempt_num}/{max_timeout_retries + 1}). "
                                  f"Waiting {backoff_time}s before retry...")
                            time.sleep(backoff_time)
                            continue
                        print(f"[GeminiClient]  '{candidate_model}' still overloaded after retries, "
                              f"trying next fallback...")
                        break
                    if "429" in msg:
                        print(f"[GeminiClient]  Free-tier rate/day limit hit on '{candidate_model}'. "
                              f"Trying next fallback (or wait and retry tomorrow)...")
                        break
                    if "404" in msg:
                        print(f"[GeminiClient]  Model '{candidate_model}' not available (404), "
                              f"trying next fallback...")
                        break
                    raise

        raise RuntimeError(f"All Gemini model candidates failed. Last error: {last_error}")

    def code(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return self.chat(system_prompt, user_prompt, model=CODE_MODEL,
                          fallbacks=CODE_MODEL_FALLBACKS, **kwargs)

    def reason(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return self.chat(system_prompt, user_prompt, model=REASONING_MODEL,
                          fallbacks=REASONING_MODEL_FALLBACKS, **kwargs)