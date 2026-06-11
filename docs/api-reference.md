# API Reference

**Base URL:** `https://api.vibecore.ai`

**Authentication:**
All non-public endpoints require either:
- `Authorization: Bearer <jwt>` (for dashboard/management)
- `Authorization: Bearer <vc-api-key>` (for the LLM gateway)

**Rate Limiting:**
Every response includes rate limit headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

All responses are returned as JSON.

---

## Gateway

### POST /v1/chat/completions
**Description:** OpenAI-compatible LLM gateway with caching and routing.  
**Auth Required:** API Key  
**Request Body:**
```json
{
  "model": "auto",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false
}
```
**Response Body:** Standard OpenAI response + `_vibecore` metadata.  
**Example:**
```bash
curl https://api.vibecore.ai/v1/chat/completions \
  -H "Authorization: Bearer vc-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hi"}]}'
```
**Errors:**
- `401`: Invalid API Key
- `429`: Rate limit exceeded
- `503`: All providers unavailable

---

## Authentication

### POST /auth/register
**Description:** Register a new user.  
**Auth Required:** None  
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "strongpassword"
}
```
**Response Body:** `{"message": "User created", "user_id": "uuid"}`  
**Example:**
```bash
curl -X POST https://api.vibecore.ai/auth/register \
  -d '{"email":"test@test.com", "password":"pass"}'
```

### POST /auth/login
**Description:** Login and receive tokens.  
**Auth Required:** None  
**Request Body:** `{"email": "...", "password": "..."}`  
**Response Body:** `{"access_token": "...", "refresh_token": "..."}`

### POST /auth/refresh
**Description:** Get new access token using refresh token.  
**Auth Required:** JWT (Refresh Token)  
**Request Body:** `{}`

### POST /auth/logout
**Description:** Invalidate current session.  
**Auth Required:** JWT  

---

## Usage & Keys

### GET /api/usage
**Description:** Get current user usage stats.  
**Auth Required:** JWT  
**Response Body:** `{"requests": 100, "tokens_saved": 500, "cost_saved": "$1.20"}`

### POST /api/keys/generate
**Description:** Generate a new API key.  
**Auth Required:** JWT  
**Request Body:** `{"name": "production-key"}`  
**Response Body:** `{"key": "vc-..."}`

### GET /api/stats/global
**Description:** Community-wide savings ticker.  
**Auth Required:** None  

---

## Admin

### POST /api/admin/users/{user_id}/upgrade
**Description:** Manually upgrade a user plan.  
**Auth Required:** JWT (Admin only)  
**Request Body:** `{"plan": "pro"}`

### DELETE /api/admin/users/{user_id}
**Description:** Delete a user and their data.  
**Auth Required:** JWT (Admin only)

### GET /api/admin/users
**Description:** List all users.  
**Auth Required:** JWT (Admin only)

---

## Payments

### POST /api/payments/razorpay/create-order
**Description:** Create a Razorpay order for subscription.  
**Auth Required:** JWT  
**Request Body:** `{"plan_id": "pro"}`

### POST /api/payments/razorpay/webhook
**Description:** Razorpay payment verification webhook.  
**Auth Required:** Razorpay Signature  

### POST /api/payments/paypal/create-order
**Description:** Create a PayPal order for subscription.  
**Auth Required:** JWT  

### POST /api/payments/paypal/webhook
**Description:** PayPal payment verification webhook.  
**Auth Required:** PayPal Signature  

---

## Health

### GET /health
**Description:** System health check.  
**Auth Required:** None  
**Response Body:** `{"status": "ok", "db": "connected", "redis": "connected"}`
