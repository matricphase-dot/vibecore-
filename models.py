from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from .database import Base
import enum

class PlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    TEAM = "team"

class CacheType(str, enum.Enum):
    EXACT = "exact"
    SEMANTIC = "semantic"
    MISS = "miss"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    plan = Column(String, default=PlanType.FREE)
    razorpay_customer_id = Column(String, nullable=True)
    razorpay_order_id = Column(String, nullable=True)
    paypal_customer_id = Column(String, nullable=True)
    subscription_id = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    requests_this_month = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    original_prompt_tokens = Column(Integer)
    optimized_prompt_tokens = Column(Integer)
    tokens_saved = Column(Integer)
    
    provider = Column(String)
    model_used = Column(String)
    input_tokens = Column(Integer)
    output_tokens = Column(Integer)
    
    actual_cost_usd = Column(Float)
    baseline_cost_usd = Column(Float)
    saved_usd = Column(Float)
    
    cache_hit = Column(Boolean, default=False)
    cache_type = Column(String) # exact, semantic, miss
    latency_ms = Column(Integer)
    complexity = Column(String) # simple, complex

class ProcessedWebhook(Base):
    __tablename__ = "processed_webhooks"
    id = Column(Integer, primary_key=True, index=True)
    webhook_id = Column(String, unique=True, index=True, nullable=False)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
