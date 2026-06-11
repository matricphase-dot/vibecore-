PRICE_TABLE = {
    # OpenAI
    "gpt-4o": {"input": 0.0025, "output": 0.010},       # per 1K tokens
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "o1-preview": {"input": 0.015, "output": 0.060},
    "o1-mini": {"input": 0.003, "output": 0.012},
    
    # Anthropic
    "claude-3-5-sonnet-20240620": {"input": 0.003, "output": 0.015},
    "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
    "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
    
    # Groq (Llama / Mixtral)
    "llama-3.3-70b-versatile": {"input": 0.00059, "output": 0.00079},
    "llama-3.1-8b-instant": {"input": 0.00005, "output": 0.00008},
    "mixtral-8x7b-32768": {"input": 0.00027, "output": 0.00027},
    
    # Baseline for comparison
    "gpt-4-baseline": {"input": 0.03, "output": 0.06}
}

def calculate_savings(input_tokens: int, output_tokens: int, actual_model: str) -> dict:
    """
    Calculate actual cost using actual_model pricing
    Calculate what it would have cost using gpt-4-baseline
    """
    # Fallback to a cheap model if not in table
    prices = PRICE_TABLE.get(actual_model, PRICE_TABLE["gpt-4o-mini"])
    baseline = PRICE_TABLE["gpt-4-baseline"]
    
    actual_cost = (input_tokens * prices["input"] / 1000) + (output_tokens * prices["output"] / 1000)
    baseline_cost = (input_tokens * baseline["input"] / 1000) + (output_tokens * baseline["output"] / 1000)
    
    saved_usd = baseline_cost - actual_cost
    saved_pct = (saved_usd / baseline_cost * 100) if baseline_cost > 0 else 0
    
    return {
        "actual_cost": round(actual_cost, 6),
        "baseline_cost": round(baseline_cost, 6),
        "saved_usd": round(saved_usd, 6),
        "saved_pct": round(saved_pct, 2)
    }

def log_usage(db, user_id, api_key_id, usage_data):
    # This will be called from main.py using SQLAlchemy session
    pass 
