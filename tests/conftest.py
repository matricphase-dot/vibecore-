import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
import fakeredis.aioredis
import factory
from factory.alchemy import SQLAlchemyModelFactory

from main import app
from database import get_db, Base
from models import User, APIKey, PlanType, RefreshToken, UsageLog
from auth import get_password_hash

# Test Database Setup
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

# Factories
class UserFactory(SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session_persistence = "commit"

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    hashed_password = get_password_hash("password123")
    plan = PlanType.FREE
    is_admin = False

class APIKeyFactory(SQLAlchemyModelFactory):
    class Meta:
        model = APIKey
        sqlalchemy_session_persistence = "commit"

    key = factory.Sequence(lambda n: f"vc-testkey-{n}")
    name = "Test Key"
    is_active = True

# Fixtures
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        UserFactory._meta.sqlalchemy_session = session
        APIKeyFactory._meta.sqlalchemy_session = session
        yield session
        await session.rollback()
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def fake_redis():
    return fakeredis.aioredis.FakeRedis()

@pytest.fixture
async def async_client(test_db, fake_redis) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    
    # Mock semantic_cache's redis
    from main import semantic_cache
    semantic_cache.redis = fake_redis
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
async def free_user(test_db):
    user = UserFactory(plan=PlanType.FREE)
    return user

@pytest.fixture
async def pro_user(test_db):
    user = UserFactory(plan=PlanType.PRO)
    return user

@pytest.fixture
async def admin_user(test_db):
    user = UserFactory(is_admin=True, plan=PlanType.TEAM)
    return user

@pytest.fixture
async def free_api_key(test_db, free_user):
    return APIKeyFactory(user_id=free_user.id)

@pytest.fixture
async def pro_api_key(test_db, pro_user):
    return APIKeyFactory(user_id=pro_user.id)

@pytest.fixture
def mock_groq_response():
    return {
        "choices": [{"message": {"content": "Groq response"}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20}
    }

@pytest.fixture
def mock_openai_response():
    return {
        "choices": [{"message": {"content": "OpenAI response"}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 25}
    }

@pytest.fixture
def mock_anthropic_response():
    return type('Response', (), {
        'content': [type('Content', (), {'text': 'Anthropic response'})],
        'usage': type('Usage', (), {'input_tokens': 12, 'output_tokens': 18})
    })
