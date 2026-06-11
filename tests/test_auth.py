import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, RefreshToken
from auth import verify_password
import asyncio

@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient, test_db: AsyncSession):
    response = await async_client.post("/auth/register", json={
        "email": "newuser@example.com",
        "password": "securepassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    
    # Verify password hash
    from sqlalchemy.future import select
    result = await test_db.execute(select(User).where(User.email == "newuser@example.com"))
    user = result.scalars().first()
    assert user is not None
    assert verify_password("securepassword", user.hashed_password)

@pytest.mark.asyncio
async def test_register_duplicate_email(async_client: AsyncClient, free_user):
    response = await async_client.post("/auth/register", json={
        "email": free_user.email,
        "password": "password123"
    })
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient, free_user):
    response = await async_client.post("/auth/login", json={
        "email": free_user.email,
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

@pytest.mark.asyncio
async def test_login_wrong_password(async_client: AsyncClient, free_user):
    response = await async_client.post("/auth/login", json={
        "email": free_user.email,
        "password": "wrongpassword"
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_refresh_token_returns_new_access_token(async_client: AsyncClient, free_user):
    # First login to get a refresh token
    login_res = await async_client.post("/auth/login", json={
        "email": free_user.email,
        "password": "password123"
    })
    refresh_token = login_res.json()["refresh_token"]
    
    # Now refresh
    response = await async_client.post(f"/auth/refresh?refresh_token_str={refresh_token}")
    assert response.status_code == 200
    assert "access_token" in response.json()

@pytest.mark.asyncio
async def test_logout_invalidates_refresh_token(async_client: AsyncClient, free_user):
    login_res = await async_client.post("/auth/login", json={
        "email": free_user.email,
        "password": "password123"
    })
    refresh_token = login_res.json()["refresh_token"]
    
    # Logout
    await async_client.post(f"/auth/logout?refresh_token_str={refresh_token}")
    
    # Try refresh again
    response = await async_client.post(f"/auth/refresh?refresh_token_str={refresh_token}")
    assert response.status_code == 401
