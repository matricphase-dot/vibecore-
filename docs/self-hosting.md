# Self-Hosting Guide

Deploy VibeCore on your own infrastructure for full control over your data and costs.

## Prerequisites

- **Docker 24+** and **docker-compose v2**.
- A server with at least **2GB RAM** (The semantic cache model requires ~500MB).
- A domain name (optional, but highly recommended for SSL).

## Step-by-Step Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/vibecore.git
cd vibecore
```

### 2. Configure Environment Variables
Copy the example file and edit it with your credentials:
```bash
cp .env.example .env
```
Ensure you set `JWT_SECRET`, `DATABASE_URL`, and at least one LLM API key (e.g., `GROQ_API_KEY`).

### 3. Start the Services
```bash
docker-compose up --build -d
```

### 4. Verify the Installation
Check if the API is running:
```bash
curl http://localhost:8000/health
```
It should return `{"status":"ok", ...}`.

### 5. Create First Admin User
Run this command once to create your admin account:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com", "password":"securepassword"}'
```
*(Note: You can then manually set the `is_admin` flag to `true` in the `users` table via SQL if needed).*

### 6. Access the Dashboard
Open `http://localhost:3000` in your browser.

---

## Environment Variable Reference

| Variable | Required | Secret? | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | Yes | `postgresql://user:pass@db:5432/vibecore` |
| `REDIS_URL` | Yes | No | `redis://redis:6379/0` |
| `JWT_SECRET` | Yes | Yes | Strong random string (e.g., `openssl rand -hex 32`) |
| `GROQ_API_KEY` | No | Yes | API key from Groq console |
| `OPENAI_API_KEY` | No | Yes | API key from OpenAI dashboard |
| `ANTHROPIC_API_KEY`| No | Yes | API key from Anthropic console |
| `CORS_ORIGINS` | No | No | Comma-separated list of allowed origins |

> [!WARNING]
> Never commit your `.env` file to version control.

---

## Production Hardening Checklist

- [ ] **Set `CORS_ORIGINS`**: Only allow your actual dashboard domain.
- [ ] **Use TLS**: Use Nginx or Caddy to terminate SSL/TLS.
- [ ] **Strong Secrets**: Generate a fresh `JWT_SECRET` for production.
- [ ] **Redis Persistence**: Ensure `appendonly yes` is set in your `redis.conf`.
- [ ] **Backups**: Set up automated daily backups for your PostgreSQL database.
- [ ] **Monitoring**: Add uptime monitoring for the `/health` endpoint.

---

## Nginx Configuration Snippet

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /v1/ {
        proxy_pass http://localhost:8000;
        proxy_read_timeout 120s;
        include proxy_params;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        include proxy_params;
    }

    location /auth/ {
        proxy_pass http://localhost:8000;
        include proxy_params;
    }

    location / {
        proxy_pass http://localhost:3000;
        include proxy_params;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "no-referrer-when-downgrade";
}
```

---

## Updating VibeCore

To update to the latest version:
```bash
git pull
docker-compose down
docker-compose up --build -d
```

---

## Troubleshooting

- **Semantic Cache slow on first request?** Check logs for "SemanticCache warmed up". It takes a few seconds to load the model into RAM.
- **500 errors on Gateway?** Check `/health` to see if your LLM API keys are correctly configured and recognized.
- **Redis connection refused?** Ensure the `redis` service is up and `REDIS_URL` points to the correct host (usually `redis` inside Docker).
- **Database migration errors?** Run migrations manually: `docker-compose exec api alembic upgrade head`.
