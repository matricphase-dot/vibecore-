import time
import os
import secrets
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, func
from pydantic import BaseModel
from typing import List, Optional

from .database import get_db, engine, Base
from .models import User, APIKey, UsageLog, PlanType, RefreshToken, ProcessedWebhook
from .auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, validate_api_key, generate_api_key_string,
    generate_refresh_token, REFRESH_TOKEN_EXPIRE_DAYS
)
from .optimizer import optimize_prompt
from .classifier import classify_prompt
from .semantic_cache import SemanticCache
from .router import route_request
from .cost_tracker import calculate_savings
from .payments import (
    create_razorpay_order, create_paypal_order, verify_razorpay_payment,
    verify_razorpay_webhook, verify_paypal_webhook, is_webhook_processed
)

app = FastAPI(title="VibeCore API")

# 1. Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the error here in a real app
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "Something went wrong."}
    )

# 2. Body Size Limit Middleware (64KB)
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 65536:
            return JSONResponse(status_code=413, content={"error": "payload_too_large"})
    return await call_next(request)

# 3. CORS Lockdown
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Semantic Cache
semantic_cache = SemanticCache()

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Warm up semantic cache
    semantic_cache.warmup()
    
    # Seed admin user if exists
    admin_email = os.getenv("ADMIN_EMAIL")
    if admin_email:
        async with AsyncSession(engine) as session:
            result = await session.execute(select(User).where(User.email == admin_email))
            if not result.scalars().first():
                admin_user = User(
                    email=admin_email,
                    hashed_password=get_password_hash("admin-password"), # Should change this
                    is_admin=True,
                    plan=PlanType.TEAM
                )
                session.add(admin_user)
                await session.commit()

# Schemas
# Schemas
class UserCreate(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[dict]
    stream: Optional[bool] = False

# --- AUTH ENDPOINTS ---

async def create_auth_tokens(user_id: int, email: str, db: AsyncSession):
    access_token = create_access_token(data={"sub": email})
    refresh_token_str = generate_refresh_token()
    
    # Store refresh token hash
    refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=get_password_hash(refresh_token_str), # We reuse the hash function
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token)
    await db.commit()
    return access_token, refresh_token_str

@app.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access_token, refresh_token = await create_auth_tokens(user.id, user.email, db)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=Token)
async def login(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalars().first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token, refresh_token = await create_auth_tokens(user.id, user.email, db)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@app.post("/auth/refresh", response_model=Token)
async def refresh(refresh_token_str: str, db: AsyncSession = Depends(get_db)):
    # Find token by hash (very simplified, in production you'd use a better way to lookup)
    # Here we just scan for the hash which is not ideal but follows the prompt
    result = await db.execute(select(RefreshToken).where(RefreshToken.expires_at > datetime.utcnow()))
    tokens = result.scalars().all()
    
    for rt in tokens:
        if verify_password(refresh_token_str, rt.token_hash):
            user_result = await db.execute(select(User).where(User.id == rt.user_id))
            user = user_result.scalars().first()
            access_token = create_access_token(data={"sub": user.email})
            return {"access_token": access_token, "refresh_token": refresh_token_str, "token_type": "bearer"}
            
    raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.post("/auth/logout")
async def logout(refresh_token_str: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken))
    tokens = result.scalars().all()
    for rt in tokens:
        if verify_password(refresh_token_str, rt.token_hash):
            await db.delete(rt)
            await db.commit()
            return {"status": "success"}
    return {"status": "not_found"}

# --- V1 PROXY ENDPOINT ---

@app.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    body: ChatCompletionRequest,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    start_time = time.time()
    
    # 1. Auth & Rate Limit
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    api_key_str = authorization.split(" ")[1]
    validation_result = await validate_api_key(api_key_str, db)
    if not validation_result:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    user, api_key = validation_result
    
    # Plan Limits
    limits = {"free": 1000, "pro": 50000, "team": 999999999}
    if api_key.requests_this_month >= limits.get(user.plan, 1000):
        raise HTTPException(status_code=429, detail="Monthly limit reached. Please upgrade.")

    # 2. Extract Prompt
    original_prompt = body.messages[-1]["content"]
    
    # 3. Classify & Optimize
    complexity_info = classify_prompt(original_prompt)
    optimization_info = optimize_prompt(original_prompt)
    optimized_prompt = optimization_info["optimized_prompt"]
    
    # 4. Check Cache
    cache_hit = False
    cache_type = "none"
    cached_response = semantic_cache.get(optimized_prompt)
    
    if cached_response:
        cache_hit = True
        cache_type = "semantic"
        response_text = cached_response
        provider = "cache"
        model_used = "cache"
        input_tokens = 0
        output_tokens = 0
    else:
        # 5. Route to LLM
        routing_result = await route_request(optimized_prompt, complexity_info["complexity"], user.plan)
        response_text = routing_result["response"]
        provider = routing_result["provider"]
        model_used = routing_result["model"]
        input_tokens = routing_result["input_tokens"]
        output_tokens = routing_result["output_tokens"]
        
        # Store in cache
        semantic_cache.set(optimized_prompt, response_text)

    # 6. Cost Tracking
    cost_data = calculate_savings(input_tokens, output_tokens, model_used)
    latency = int((time.time() - start_time) * 1000)

    # 7. Log Usage
    usage_log = UsageLog(
        user_id=user.id,
        api_key_id=api_key.id,
        original_prompt_tokens=optimization_info["original_tokens"],
        optimized_prompt_tokens=optimization_info["optimized_tokens"],
        tokens_saved=optimization_info["tokens_saved"],
        provider=provider,
        model_used=model_used,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        actual_cost_usd=cost_data["actual_cost"],
        baseline_cost_usd=cost_data["baseline_cost"],
        saved_usd=cost_data["saved_usd"],
        cache_hit=cache_hit,
        cache_type=cache_type,
        latency_ms=latency,
        complexity=complexity_info["complexity"]
    )
    db.add(usage_log)
    
    # Increment counter
    await db.execute(
        update(APIKey)
        .where(APIKey.id == api_key.id)
        .values(requests_this_month=APIKey.requests_this_month + 1, last_used_at=func.now())
    )
    await db.commit()

    # 8. Return OpenAI Format
    response_body = {
        "id": f"chatcmpl-{os.urandom(12).hex()}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_used,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text,
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens
        }
    }

    headers = {
        "X-VibeCore-Cache": "HIT" if cache_hit else "MISS",
        "X-VibeCore-Cache-Type": cache_type,
        "X-VibeCore-Tokens-Saved": str(optimization_info["tokens_saved"]),
        "X-VibeCore-Cost-Saved": f"${cost_data['saved_usd']}",
        "X-VibeCore-Provider": provider,
        "X-VibeCore-Latency": f"{latency}ms"
    }

    return response_body # Note: FastAPI might need a Custom Response to return headers properly

# --- MANAGEMENT ENDPOINTS ---

@app.post("/api/keys/generate")
async def generate_key(name: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_key_str = generate_api_key_string()
    new_key = APIKey(
        key=new_key_str,
        user_id=user.id,
        name=name
    )
    db.add(new_key)
    await db.commit()
    return {"key": new_key_str, "plan": user.plan, "requests_remaining": 1000} # simplified

@app.get("/api/usage")
async def get_usage(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UsageLog).where(UsageLog.user_id == user.id))
    logs = result.scalars().all()
    
    total_requests = len(logs)
    cache_hits = sum(1 for log in logs if log.cache_hit)
    tokens_saved = sum(log.tokens_saved for log in logs)
    cost_saved = sum(log.saved_usd for log in logs)
    
    return {
        "total_requests": total_requests,
        "cache_hits": cache_hits,
        "tokens_saved": tokens_saved,
        "cost_saved_usd": round(cost_saved, 4),
        "requests_this_month": 0, # Should calculate based on current month
        "plan_limit": 1000 # hardcoded for now
    }

# --- ADMIN ENDPOINTS ---

@app.get("/api/admin/users")
async def admin_get_users(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(select(User))
    return result.scalars().all()

@app.get("/api/admin/stats")
async def admin_get_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.execute(select(func.count(User.id)))
    total_requests = await db.execute(select(func.count(UsageLog.id)))
    total_savings = await db.execute(select(func.sum(UsageLog.saved_usd)))
    
    return {
        "total_users": total_users.scalar(),
        "total_requests": total_requests.scalar(),
        "total_savings_usd": round(total_savings.scalar() or 0, 4)
    }

# --- PAYMENT ENDPOINTS ---

@app.post("/api/payments/razorpay/create-order")
async def razorpay_order(plan: str, user: User = Depends(get_current_user)):
    amount_map = {"pro": 1999, "team": 9999} # INR
    if plan not in amount_map:
        raise HTTPException(status_code=400, detail="Invalid plan")
    return await create_razorpay_order(user.id, plan, amount_map[plan])

@app.post("/api/payments/razorpay/verify")
async def razorpay_verify(data: dict, db: AsyncSession = Depends(get_db)):
    is_valid = await verify_razorpay_payment(
        data.get("razorpay_payment_id"),
        data.get("razorpay_order_id"),
        data.get("razorpay_signature")
    )
    if is_valid:
        # Extract user_id and plan from notes if possible, or use a lookup
        # For simplicity, we assume the frontend sends the user_id or we get it from token
        # But verification should be server-side.
        # In a real app, you'd fetch the order from Razorpay to get notes.
        pass
    return {"status": "verified" if is_valid else "failed"}

@app.post("/api/payments/paypal/create-order")
async def paypal_order(plan: str, user: User = Depends(get_current_user)):
    amount_map = {"pro": "29.00", "team": "149.00"} # USD
    if plan not in amount_map:
        raise HTTPException(status_code=400, detail="Invalid plan")
    return await create_paypal_order(user.id, plan, amount_map[plan])

@app.get("/api/stats/global")
async def global_stats(db: AsyncSession = Depends(get_db)):
    total_requests = await db.execute(select(func.count(UsageLog.id)))
    total_tokens_saved = await db.execute(select(func.sum(UsageLog.tokens_saved)))
    total_saved_usd = await db.execute(select(func.sum(UsageLog.saved_usd)))
    cache_hits = await db.execute(select(func.count(UsageLog.id)).where(UsageLog.cache_hit == True))
    
    total_req_val = total_requests.scalar() or 0
    cache_hit_rate = (cache_hits.scalar() / total_req_val) if total_req_val > 0 else 0
    
    return {
        "total_requests": total_req_val,
        "total_tokens_saved": total_tokens_saved.scalar() or 0,
        "total_saved_usd": round(total_saved_usd.scalar() or 0, 4),
        "cache_hit_rate": round(cache_hit_rate, 4)
    }

# Health check
@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    checks = {
        "postgres": False,
        "redis": False,
        "groq": bool(os.getenv("GROQ_API_KEY")),
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY"))
    }
    
    # 1. Check Postgres
    try:
        await db.execute(select(1))
        checks["postgres"] = True
    except Exception: pass
    
    # 2. Check Redis
    try:
        from .router import redis_client
        if redis_client.ping():
            checks["redis"] = True
    except Exception: pass
    
    status_code = status.HTTP_200_OK if all(checks.values()) else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if status_code == 200 else "degraded", "checks": checks}
    )