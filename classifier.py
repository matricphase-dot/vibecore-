def classify_prompt(prompt: str) -> dict:
    """
    Classify prompts as simple or complex for routing decisions.
    - "simple": short factual Q&A, single-step tasks, greetings (use fast/cheap model)
    - "complex": code generation, multi-step reasoning, analysis, creative writing (use capable model)
    """
    prompt_lower = prompt.lower()
    
    # Simple heuristics for complexity
    complex_keywords = [
        "code", "python", "javascript", "implement", "analyze", 
        "evaluate", "step by step", "reason", "creative", "story",
        "essay", "compare and contrast", "architect", "debug"
    ]
    
    # Basic triggers
    is_long = len(prompt.split()) > 50
    has_complex_keyword = any(keyword in prompt_lower for keyword in complex_keywords)
    
    if is_long or has_complex_keyword:
        return {
            "complexity": "complex",
            "confidence": 0.85,
            "reasoning": "Detected complex keywords or high word count."
        }
    else:
        return {
            "complexity": "simple",
            "confidence": 0.90,
            "reasoning": "Short prompt without specific complex triggers."
        }
