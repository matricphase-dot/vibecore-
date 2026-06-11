import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from router import route_request, CIRCUIT
import time

@pytest.fixture(autouse=True)
def reset_circuit():
    for p in CIRCUIT:
        CIRCUIT[p]["failures"] = 0
        CIRCUIT[p]["open_until"] = None

@pytest.mark.asyncio
async def test_simple_free_routes_to_groq():
    with patch("router.AsyncGroq") as mock_groq:
        mock_groq.return_value.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="groq"))],
            usage=MagicMock(prompt_tokens=10, completion_tokens=10)
        ))
        res = await route_request("hi", "simple", "free")
        assert res["provider"] == "groq"

@pytest.mark.asyncio
async def test_complex_pro_routes_to_openai_or_anthropic():
    with patch("router.AsyncOpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="openai"))],
            usage=MagicMock(prompt_tokens=10, completion_tokens=10)
        ))
        res = await route_request("complex task", "complex", "pro")
        # By default it might pick OpenAI or Anthropic depending on latency, 
        # but since latencies are 0, it picks first candidate (OpenAI)
        assert res["provider"] in ["openai", "anthropic"]

@pytest.mark.asyncio
async def test_fallback_on_groq_failure():
    with patch("router.AsyncGroq") as mock_groq:
        # First call fails, second call (fallback) succeeds
        mock_groq.return_value.chat.completions.create = AsyncMock(side_effect=[
            Exception("Fail"),
            MagicMock(
                choices=[MagicMock(message=MagicMock(content="fallback"))],
                usage=MagicMock(prompt_tokens=10, completion_tokens=10)
            )
        ])
        res = await route_request("hi", "simple", "free")
        assert res["provider"] == "groq"
        assert res["response"] == "fallback"

@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_3_failures():
    with patch("router.AsyncGroq") as mock_groq:
        mock_groq.return_value.chat.completions.create = AsyncMock(side_effect=Exception("Fail"))
        
        for _ in range(3):
            await route_request("hi", "simple", "free")
        
        assert CIRCUIT["groq"]["open_until"] is not None

@pytest.mark.asyncio
async def test_latency_recorded_in_redis():
    with patch("router.AsyncGroq") as mock_groq, patch("router.redis_client") as mock_redis:
        mock_groq.return_value.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="groq"))],
            usage=MagicMock(prompt_tokens=10, completion_tokens=10)
        ))
        await route_request("hi", "simple", "free")
        assert mock_redis.lpush.called

@pytest.mark.asyncio
async def test_p95_latency_prefers_faster_provider():
    # Mock Redis to show OpenAI is faster
    with patch("router.AsyncOpenAI") as mock_openai, \
         patch("router.AsyncAnthropic") as mock_anthropic, \
         patch("router.get_provider_p95_latency") as mock_p95:
        
        mock_p95.side_effect = lambda p: 50.0 if p == "openai" else 400.0
        
        mock_openai.return_value.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="fast"))],
            usage=MagicMock(prompt_tokens=10, completion_tokens=10)
        ))
        
        res = await route_request("complex", "complex", "pro")
        assert res["provider"] == "openai"
