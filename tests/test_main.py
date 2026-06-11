import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock
import os

@pytest.mark.asyncio
async def test_chat_missing_auth(async_client: AsyncClient):
    response = await async_client.post("/v1/chat/completions", json={
        "model": "auto",
        "messages": [{"role": "user", "content": "hi"}]
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_chat_invalid_key(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer vc-invalid"},
        json={"model": "auto", "messages": [{"role": "user", "content": "hi"}]}
    )
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_chat_valid_request_groq(async_client: AsyncClient, free_api_key, mock_groq_response):
    with patch("router.AsyncGroq") as mock_groq:
        mock_groq.return_value.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="Groq response"))],
            usage=MagicMock(prompt_tokens=10, completion_tokens=10)
        ))
        
        response = await async_client.post(
            "/v1/chat/completions",
            headers={"Authorization": f"Bearer {free_api_key.key}"},
            json={"model": "auto", "messages": [{"role": "user", "content": "hi"}]}
        )
        assert response.status_code == 200
        assert response.json()["choices"][0]["message"]["content"] == "Groq response"
        assert response.headers["X-VibeCore-Provider"] == "groq"

@pytest.mark.asyncio
async def test_chat_body_too_large(async_client: AsyncClient, free_api_key):
    large_body = "a" * 70000
    response = await async_client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {free_api_key.key}"},
        json={"model": "auto", "messages": [{"role": "user", "content": large_body}]}
    )
    assert response.status_code == 413

@pytest.mark.asyncio
async def test_usage_returns_correct_fields(async_client: AsyncClient, free_user):
    # Login to get JWT
    login_res = await async_client.post("/auth/login", json={
        "email": free_user.email,
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    
    response = await async_client.get(
        "/api/usage",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_requests" in data
    assert "cache_hits" in data
    assert "tokens_saved" in data
    assert "cost_saved_usd" in data

from unittest.mock import AsyncMock
