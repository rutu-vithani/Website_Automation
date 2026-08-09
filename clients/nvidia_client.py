"""
Nvidia NIM API client.
All agents (CEO, Frontend, Database, Backend, Testing) call through this
single wrapper so the model can be swapped centrally.
"""
import os
import time
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")

# Use the coder model for anything that outputs code (HTML/CSS/JS/Python).
CODE_MODEL = os.environ.get("NVIDIA_CODE_MODEL", "meta/llama-3.1-8b-instruct")
# Use the reasoning model for planning / brief-creation / bug-analysis / decisions.
REASONING_MODEL = os.environ.get("NVIDIA_REASONING_MODEL", "meta/llama-3.1-8b-instruct")

# Ordered fallback chains. If the primary model id 404s/410s (deprecated, EOL,
# or not enabled on this account), the client automatically tries the next one,
# so a single catalog change doesn't break the whole pipeline.
# Prioritize smaller, faster models first to avoid timeouts
CODE_MODEL_FALLBACKS = [
    CODE_MODEL,
    "meta/llama-3.1-8b-instruct",   # Fast and reliable 
    "meta/llama-3.1-70b-instruct",  # Larger model
    "qwen/qwen2.5-coder-7b-instruct",
    "qwen/qwen2.5-coder-32b-instruct",
    "meta/llama-3.3-70b-instruct",
]
REASONING_MODEL_FALLBACKS = [
    REASONING_MODEL,
    "meta/llama-3.1-8b-instruct",   # Fast and reliable 
    "meta/llama-3.1-70b-instruct",  # Larger model
    "meta/llama-3.3-70b-instruct",
    "nvidia/nemotron-3-super-120b-a12b",
]


class NvidiaClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or NVIDIA_API_KEY
        if not self.api_key:
            raise RuntimeError(
                "NVIDIA_API_KEY missing. Set it in your .env file before running any agent."
            )
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Create a session with retry strategy for connection errors
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def _chat_once(self, system_prompt: str, user_prompt: str, model: str,
                          temperature: float, max_tokens: int, timeout: int = 60) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        resp = self.session.post(
            f"{NVIDIA_BASE_URL}/chat/completions",
            headers=self.headers,
            json=payload,
            timeout=timeout,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Nvidia API error {resp.status_code}: {resp.text[:500]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    def chat(self, system_prompt: str, user_prompt: str, model: str = None,
                  temperature: float = 0.4, max_tokens: int = 8000,
                  fallbacks: list = None, timeout: int = 60,
              max_timeout_retries: int = 2) -> str:
        """
        Single-turn chat completion with automatic fallback + retry.
        - On 404/410 (model not found / deprecated): tries the next model in `fallbacks`.
        - On a read timeout (model just being slow): retries the SAME model up to
          `max_timeout_retries` times with exponential backoff before moving on to the next fallback.
        """
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
                    print(f"[NvidiaClient] Trying '{candidate_model}' (attempt {attempt_num}, timeout={current_timeout}s)...")
                    result = self._chat_once(
                        system_prompt, user_prompt, candidate_model, temperature, max_tokens, current_timeout
                    )
                    if candidate_model != candidates[0] or timeout_retries > 0:
                        print(f"[NvidiaClient]  Succeeded using model '{candidate_model}' "
                              f"(attempt {attempt_num}).")
                    return result
                    
                except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError) as e:
                    last_error = e
                    timeout_retries += 1
                    
                    if timeout_retries <= max_timeout_retries:
                        backoff_time = 2 ** (timeout_retries - 1)  # Exponential backoff: 1s, 2s, 4s
                        current_timeout = min(timeout * (1.5 ** timeout_retries), 180)  # Increase timeout, max 180s
                        print(f"[NvidiaClient]  Timeout on '{candidate_model}' "
                              f"(attempt {attempt_num}/{max_timeout_retries + 1}). "
                              f"Waiting {backoff_time}s before retry with {current_timeout}s timeout...")
                        time.sleep(backoff_time)
                    else:
                        print(f"[NvidiaClient]  Max retries exceeded for '{candidate_model}', "
                              f"trying next fallback model...")
                        break  # Move to next candidate model
                        
                except RuntimeError as e:
                    msg = str(e)
                    last_error = e
                    if "404" in msg or "410" in msg:
                        print(f"[NvidiaClient] ✗ Model '{candidate_model}' not available (404/410), "
                              f"trying next fallback...")
                        break  # stop retrying this model, move to next fallback
                    raise  # any other error (auth, rate limit, etc) should surface immediately
                    
        raise RuntimeError(f"All Nvidia model candidates failed. Last error: {last_error}")

    def code(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        """Convenience wrapper that uses the coder model with fallbacks."""
        return self.chat(system_prompt, user_prompt, model=CODE_MODEL,
                         fallbacks=CODE_MODEL_FALLBACKS, **kwargs)

    def reason(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        """Convenience wrapper that uses the reasoning model with fallbacks."""
        return self.chat(system_prompt, user_prompt, model=REASONING_MODEL,
                         fallbacks=REASONING_MODEL_FALLBACKS, **kwargs)
    
    def test_models(self, models_to_test: list = None) -> dict:
        """Test which models are available and responding. Returns dict of model -> status."""
        if models_to_test is None:
            models_to_test = list(set(CODE_MODEL_FALLBACKS + REASONING_MODEL_FALLBACKS))
        
        results = {}
        test_prompt = "Hello"
        
        for model in models_to_test:
            try:
                print(f"[NvidiaClient] Testing model: {model}...")
                self._chat_once("You are a test.", test_prompt, model, 0.1, 10, timeout=30)
                results[model] = " Available"
                print(f"[NvidiaClient]  {model} is working")
            except requests.exceptions.ReadTimeout:
                results[model] = " Timeout (slow but may work with retries)"
                print(f"[NvidiaClient]  {model} timed out")
            except RuntimeError as e:
                if "404" in str(e) or "410" in str(e):
                    results[model] = " Not available (404/410)"
                    print(f"[NvidiaClient]  {model} not available")
                else:
                    results[model] = f" Error: {str(e)[:100]}"
                    print(f"[NvidiaClient]  {model} error: {str(e)[:100]}")
            except Exception as e:
                results[model] = f" Error: {str(e)[:100]}"
                print(f"[NvidiaClient]  {model} error: {str(e)[:100]}")
        
        return results
