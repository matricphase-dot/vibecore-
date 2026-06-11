# VibeCore 🚀 — "Cloudflare for LLMs"

VibeCore is a production-ready, full-stack SaaS LLM cost optimization platform and proxy layer. Positioned as an intelligent gateway sitting between client applications and downstream LLM API providers (Gemma, Groq, OpenAI, Anthropic), VibeCore reduces API bills by up to 80% through exact/semantic caching, regex-based prompt optimization, and smart latency-aware routing.

---

## ⚡ Core Features

- **Prompt Optimization:** strips redundant conversational filler phrases and repetitive spacing/newlines, yielding up to 15% token savings.
- **Dual-Layer Caching:** exact-match MD5 caching combined with local vector embeddings (`all-MiniLM-L6-v2`) via `@xenova/transformers` for semantic similarity cache lookup matching above a 0.88 threshold.
- **Gemma-First Routing:** routes requests first to a customized Gemma 2B-IT model running on a Google Colab GPU backend ($0 compute cost), falling back dynamically to Groq, OpenAI, and Anthropic in case of degradation or timeout.
- **Circuit Breakers:** trips and puts providers on 60-second cooldowns after 3 consecutive request failures.
- **Subscription Monetization:** Razorpay (INR) and PayPal (USD) API setups linking automatic user upgrades via signature-verified webhooks.
- **Admin telemetry console:** platforms overview statistics dashboard, user profiles plan patching, and deletion.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Upstash Redis (caching), `@xenova/transformers` (local embedder), Supabase client.
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons.
- **SDK:** lightweight CommonJS package using native HTTP/HTTPS modules.
- **Notebook:** 7-cell Jupyter Notebook for Colab model loading, PEFT LoRA training, FastAPI inference gateway, and ngrok tunnel setup.

---

## 🚀 How to Setup and Run

Follow these instructions to build and run the entire platform locally:

### 1. Database Setup
1. Create a project on [Supabase](https://supabase.com/).
2. Run the complete contents of [supabase/schema.sql](file:///d:/vibecore/supabase/schema.sql) in the Supabase SQL Editor to initialize all tables, RLS policies, views, triggers, and RPC procedures.

### 2. Custom Gemma Model Setup
1. Open the [colab/vibecore_gemma_server.ipynb](file:///d:/vibecore/colab/vibecore_gemma_server.ipynb) notebook in Google Colab.
2. Provide your Hugging Face Token (`HF_TOKEN`) and Ngrok Authtoken (`NGROK_TOKEN`).
3. Run all cells. Copy the output `GEMMA_BASE_URL` (e.g. `https://xxxx.ngrok-free.app`) generated in **Cell 5**.

### 3. Backend Configurations
Copy `.env.example` to `backend/.env` and input all credentials:
```bash
cp .env.example backend/.env
```
Fill in the following variables:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `GEMMA_BASE_URL` (copied from Colab Cell 5)
- Fallback credentials: `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`
- Payment keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PAYPAL_CLIENT_ID`

### 4. Frontend Configurations
Create a `.env` file inside the `frontend/` directory and fill in your Supabase details:
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 5. Install Dependencies
Run the install workspaces command at the root directory to set up backend, frontend, and SDK modules:
```bash
npm run install:all
```

### 6. Run the Application
Start both the Express API server (port 3001) and Vite React client server (port 5173) concurrently:
```bash
npm run dev
```

---

## 📡 Gateway Integration (SDK Usage)

Integrate VibeCore into any codebase using our CommonJS SDK client wrapper:

```javascript
const VibeCore = require('vibecore-sdk');

const vc = new VibeCore({
  apiKey: 'vc-your-generated-api-key',
  baseUrl: 'http://localhost:3001'
});

async function main() {
  const response = await vc.chat.completions.create({
    model: 'auto',
    messages: [{ role: 'user', content: 'What is semantic caching?' }]
  });

  console.log(response.choices[0].message.content);
}

main();
```
Check details about Cache HITs, latency logs, and cost savings metrics in the HTTP response headers:
- `X-VibeCore-Cache`: `HIT` | `MISS`
- `X-VibeCore-Cache-Type`: `exact` | `semantic` | `none`
- `X-VibeCore-Provider`: routed model provider
- `X-VibeCore-Latency`: response completion latency in ms
- `X-VibeCore-Cost-Saved`: cumulative USD saved

---

## 🧪 Testing SDK Caching

Navigate to the SDK directory and execute the test command to verify exact matching cache lookups:
```bash
cd vibecore-sdk
npm test
```
The script will submit two identical completions sequentially. The second run should resolve within milliseconds, indicating a cache hit.
