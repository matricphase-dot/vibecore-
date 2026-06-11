import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

@pytest.mark.asyncio
async def test_health_all_ok(async_client: AsyncClient):
    # Mock redis ping
    with patch("router.redis_client.ping", return_value=True), \
         patch("main.os.getenv") as mock_env:
        
        mock_env.side_effect = lambda k, d=None: "key" if "API_KEY" in k else d
        
        response = await async_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert all(data["checks"].values())

@pytest.mark.asyncio
async def test_health_postgres_down(async_client: AsyncClient):
    with patch("sqlalchemy.ext.asyncio.AsyncSession.execute", side_effect=Exception("DB Down")):
        response = await async_client.get("/health")
        assert response.status_code == 503
        assert response.json()["checks"]["postgres"] is False

@pytest.mark.asyncio
async def test_health_missing_groq_key(async_client: AsyncClient):
    with patch("main.os.getenv") as mock_env:
        mock_env.side_effect = lambda k, d=None: "" if "GROQ_API_KEY" in k else "key"
        
        response = await async_client.get("/health")
        assert response.status_code == 503
        assert response.json()["checks"]["groq"] is False
