# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-01

### Added
- OpenAI-compatible `/v1/chat/completions` gateway.
- Rule-based prompt optimizer (filler phrase removal, truncation).
- Exact match Redis cache.
- Semantic cache with `sentence-transformers` (cosine sim 0.88 threshold).
- Multi-provider router: Groq, OpenAI, Anthropic with automatic fallback.
- In-memory circuit breaker (3 failures → 60s cooldown per provider).
- p95 latency tracking per provider in Redis, latency-aware routing.
- JWT auth (1h access token + 7d refresh token rotation).
- API key system with Free / Pro / Team plan limits.
- Razorpay + PayPal payment integration with webhook verification.
- Idempotent webhook processing via `processed_webhooks` table.
- Usage dashboard (requests, cache hits, tokens saved, cost saved).
- Admin panel (user list, upgrade, delete).
- `/health` endpoint (Postgres, Redis, LLM key checks).
- `/api/stats/global` for community savings ticker.
- Full `pytest` suite (87% coverage) + Jest SDK tests.
- GitHub Actions CI (parallel backend + SDK jobs, 85% coverage gate).
- Docker + `docker-compose` setup.
- 64KB request body limit (DoS protection).
- CORS origin whitelist from env var.

### Security
- Razorpay webhook signature verification.
- PayPal webhook signature verification.
- `JWT_SECRET` required at startup (no fallback).
- API keys masked in frontend by default.
