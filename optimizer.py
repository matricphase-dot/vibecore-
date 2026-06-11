import re

def optimize_prompt(prompt: str) -> dict:
    """
    Rule-based prompt optimizer that reduces token count.
    """
    original_prompt = prompt
    
    # 1. Strip redundant whitespace
    prompt = " ".join(prompt.split())
    
    # 2. Strip repeated punctuation (e.g. !!! -> !, ??? -> ?)
    prompt = re.sub(r'([!?.]){2,}', r'\1', prompt)
    
    # 3. Remove filler phrases (be careful with word boundaries)
    fillers = [
        "please", "could you", "i would like you to", "kindly", 
        "as an ai", "if you don't mind", "i was wondering if",
        "can you help me with", "it would be great if"
    ]
    for filler in fillers:
        pattern = re.compile(r'\b' + re.escape(filler) + r'\b', re.IGNORECASE)
        prompt = pattern.sub("", prompt)
    
    # 4. Remove multiple newlines/tabs
    prompt = re.sub(r'\n+', '\n', prompt)
    prompt = re.sub(r'\t+', ' ', prompt)
    
    # Final cleanup
    prompt = " ".join(prompt.split()).strip()
    
    # 5. Truncation (using character count as a proxy for tokens)
    max_tokens = 4000 # Increased for modern models
    char_limit = max_tokens * 4
    
    if len(prompt) > char_limit:
        keep_start = int(3500 * 4)
        keep_end = int(500 * 4)
        prompt = prompt[:keep_start] + "\n...[TRUNCATED]...\n" + prompt[-keep_end:]
    
    # Heuristic token counts
    original_tokens = len(original_prompt) // 4
    optimized_tokens = len(prompt) // 4
    tokens_saved = original_tokens - optimized_tokens
    
    return {
        "optimized_prompt": prompt,
        "original_tokens": original_tokens,
        "optimized_tokens": optimized_tokens,
        "tokens_saved": max(0, tokens_saved)
    }
