import pytest
from optimizer import optimize_prompt

def test_strips_leading_trailing_whitespace():
    assert optimize_prompt("  hello  ")["optimized_prompt"] == "hello"

def test_removes_please_prefix():
    assert "please" not in optimize_prompt("Please summarize this")["optimized_prompt"].lower()

def test_removes_could_you():
    assert "could you" not in optimize_prompt("Could you explain X")["optimized_prompt"].lower()

def test_removes_as_an_ai():
    assert "as an ai" not in optimize_prompt("As an AI, explain physics")["optimized_prompt"].lower()

def test_removes_i_would_like_you_to():
    assert "i would like you to" not in optimize_prompt("I would like you to write a poem")["optimized_prompt"].lower()

def test_removes_kindly():
    assert "kindly" not in optimize_prompt("Kindly review this code")["optimized_prompt"].lower()

def test_collapses_multiple_spaces():
    assert optimize_prompt("hello    world")["optimized_prompt"] == "hello world"

def test_collapses_repeated_punctuation():
    assert optimize_prompt("What!!!")["optimized_prompt"] == "What!"
    assert optimize_prompt("Really???")["optimized_prompt"] == "Really?"

def test_truncation_over_4000_tokens():
    long_prompt = "a " * 5000
    result = optimize_prompt(long_prompt)
    assert len(result["optimized_prompt"]) < len(long_prompt)
    assert "[TRUNCATED]" in result["optimized_prompt"]

def test_no_change_clean_prompt():
    prompt = "Summarize this document"
    assert optimize_prompt(prompt)["optimized_prompt"] == prompt

def test_returns_dict_with_correct_keys():
    result = optimize_prompt("test")
    assert set(result.keys()) == {"original_tokens", "optimized_tokens", "tokens_saved", "optimized_prompt"}

def test_tokens_saved_is_non_negative():
    assert optimize_prompt("test")["tokens_saved"] >= 0
