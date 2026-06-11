import time
import os
import numpy as np
from redis import Redis
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from groq import AsyncGroq

# In-memory circuit breaker
CIRCUIT = {
    "groq": {"failures": 0, "open_until": None},
    "openai": {"failures": 0, "open_until": None},
    "anthropic": {"failures": 0, "open_until": None}
}

redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)

def is_circuit_open(provider: str) -> bool:
    state = CIRCUIT.get(provider)
    if not state or not state["open_until"]:
        return False
    if time.time() > state["open_until"]:
        state["open_until"] = None
        state["failures"] = 0
        return False
    return True

def record_failure(provider: str):
    state = CIRCUIT.get(provider)
    if not state: return
    state["failures"] += 1
    if state["failures"] >= 3:
        state["open_until"] = time.time() + 60 # Open for 60s

def record_success(provider: str, latency_ms: int):
    state = CIRCUIT.get(provider)
    if not state: return
    state["failures"] = 0
    state["open_until"] = None
    
    # Track latency in Redis
    key = f"provider:{provider}:latencies"
    redis_client.lpush(key, latency_ms)
    redis_client.ltrim(key, 0, 99) # Keep last 100

def get_provider_p95_latency(provider: str) -> float:
    key = f"provider:{provider}:latencies"
    latencies = redis_client.lrange(key, 0, -1)
    if not latencies:
        return 0.0
    return float(np.percentile([int(l) for l in latencies], 95))

async def route_request(prompt: str, complexity: str, user_plan: str) -> dict:
    """
    Intelligent multi-provider LLM router with circuit breaker and latency awareness.
    """
    
    # 1. Determine candidate providers/models based on plan and complexity
    candidates = [] # List of (provider, model)
    
    if complexity == "simple":
        candidates = [("groq", "llama-3.1-8b-instant")]
    else:
        if user_plan == "free":
            candidates = [("groq", "llama-3.3-70b-versatile")]
        elif user_plan == "pro":
            candidates = [("openai", "gpt-4o-mini"), ("anthropic", "claude-3-haiku-20240307")]
        elif user_plan == "team":
            candidates = [("openai", "gpt-4o"), ("anthropic", "claude-3-5-sonnet-20240620")]

    # 2. Filter by circuit breaker
    healthy_candidates = [c for c in candidates if not is_circuit_open(c[0])]
    
    if not healthy_candidates:
        # Emergency fallback if all selected are down
        provider, model = ("groq", "llama-3.3-70b-versatile")
    elif len(healthy_candidates) == 1:
        provider, model = healthy_candidates[0]
    else:
        # 3. Prefer provider with lowest p95 latency
        latencies = {c[0]: get_provider_p95_latency(c[0]) for c in healthy_candidates}
        provider, model = min(healthy_candidates, key=lambda c: latencies[c[0]])
    
    # Clients
    openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    
    start_time = time.time()
    
    try:
        if provider == "groq":
            response = await groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content
            usage = response.usage
        elif provider == "openai":
            response = await openai_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content
            usage = response.usage
        elif provider == "anthropic":
            response = await anthropic_client.messages.create(
                model=model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.content[0].text
            usage = type('Usage', (), {
                'prompt_tokens': response.usage.input_tokens,
                'completion_tokens': response.usage.output_tokens
            })
        
        latency = int((time.time() - start_time) * 1000)
        record_success(provider, latency)
        
        return {
            "provider": provider,
            "model": model,
            "response": content,
            "input_tokens": usage.prompt_tokens,
            "output_tokens": usage.completion_tokens,
            "latency_ms": latency
        }

    except Exception as e:
        print(f"Provider {provider} failed: {e}")
        record_failure(provider)
        
        # Fallback to Groq if anything fails
        fallback_model = "llama-3.3-70b-versatile"
        response = await groq_client.chat.completions.create(
            model=fallback_model,
            messages=[{"role": "user", "content": prompt}]
        )
        latency = int((time.time() - start_time) * 1000)
        return {
            "provider": "groq",
            "model": fallback_model,
            "response": response.choices[0].message.content,
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "latency_ms": latency
        }
