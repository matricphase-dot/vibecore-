import pytest
from classifier import classify_prompt

def test_simple_greeting():
    assert classify_prompt("Hi!")["complexity"] == "simple"

def test_simple_factual():
    assert classify_prompt("What is the capital of France?")["complexity"] == "simple"

def test_complex_code():
    assert classify_prompt("Write a Python async web scraper with retry logic")["complexity"] == "complex"

def test_complex_analysis():
    assert classify_prompt("Analyze the geopolitical implications of the 2024 US election on NATO")["complexity"] == "complex"

def test_complex_creative():
    assert classify_prompt("Write a 500-word short story about a time traveler")["complexity"] == "complex"

def test_returns_confidence():
    result = classify_prompt("test")
    assert isinstance(result["confidence"], float)
    assert 0.0 <= result["confidence"] <= 1.0

def test_returns_reasoning():
    result = classify_prompt("test")
    assert isinstance(result["reasoning"], str)
    assert len(result["reasoning"]) > 0

def test_returns_correct_keys():
    result = classify_prompt("test")
    assert set(result.keys()) == {"complexity", "confidence", "reasoning"}
