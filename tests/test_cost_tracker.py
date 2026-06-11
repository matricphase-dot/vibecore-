import pytest
from cost_tracker import calculate_savings

def test_groq_cost_is_less_than_baseline():
    result = calculate_savings(1000, 1000, "llama-3.3-70b-versatile")
    assert result["actual_cost"] < result["baseline_cost"]

def test_saved_pct_is_positive():
    result = calculate_savings(1000, 1000, "gpt-4o-mini")
    assert result["saved_pct"] > 0

def test_saved_pct_formula():
    result = calculate_savings(1000, 1000, "gpt-4o")
    expected_pct = (result["baseline_cost"] - result["actual_cost"]) / result["baseline_cost"] * 100
    assert abs(result["saved_pct"] - expected_pct) < 0.01

def test_actual_cost_calculation():
    # gpt-4o-mini: input 0.00015, output 0.0006 per 1K
    # (1000/1000)*0.00015 + (500/1000)*0.0006 = 0.00015 + 0.0003 = 0.00045
    result = calculate_savings(1000, 500, "gpt-4o-mini")
    assert abs(result["actual_cost"] - 0.00045) < 0.000001

def test_baseline_cost_calculation():
    # gpt-4-baseline: input 0.03, output 0.06 per 1K
    # (1000/1000)*0.03 + (500/1000)*0.06 = 0.03 + 0.03 = 0.06
    result = calculate_savings(1000, 500, "gpt-4o-mini")
    assert abs(result["baseline_cost"] - 0.06) < 0.000001

def test_returns_all_required_keys():
    result = calculate_savings(10, 10, "gpt-4o")
    assert set(result.keys()) == {"actual_cost", "baseline_cost", "saved_usd", "saved_pct"}

def test_zero_tokens_returns_zero_cost():
    result = calculate_savings(0, 0, "gpt-4o")
    assert result["actual_cost"] == 0.0
    assert result["baseline_cost"] == 0.0
    assert result["saved_usd"] == 0.0
    assert result["saved_pct"] == 0.0
