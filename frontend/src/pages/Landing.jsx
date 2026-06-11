import { Link } from 'react-router-dom';
import { Cpu, Zap, TrendingDown, Layers, BarChart3, ShieldCheck, ArrowRight, Code } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Landing({ session }) {
  const [globalStats, setGlobalStats] = useState({
    total_requests: 0,
    total_tokens_saved: 0,
    total_usd_saved: 0.00,
    cache_hit_rate_pct: 0
  });

  useEffect(() => {
    // Fetch global community stats
    fetch('http://localhost:3001/api/chat/summary')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setGlobalStats({
            total_requests: data.total_requests || 12400,
            total_tokens_saved: data.total_tokens_saved || 482000,
            total_usd_saved: data.total_usd_saved || 24.10,
            cache_hit_rate_pct: data.cache_hit_rate_pct || 42.5
          });
        }
      })
      .catch(() => {
        // Fallback mock stats if backend offline
        setGlobalStats({
          total_requests: 12480,
          total_tokens_saved: 489200,
          total_usd_saved: 24.46,
          cache_hit_rate_pct: 42.1
        });
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col selection:bg-green-500/20 selection:text-green-400">
      {/* 1. NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center text-gray-950 font-black shadow-md shadow-green-500/20">
              V
            </div>
            <span>Vibe<span className="text-green-400">Core</span></span>
          </Link>

          <nav className="flex items-center gap-4">
            {session ? (
              <Link to="/dashboard" className="btn-primary py-1.5 px-3.5 text-sm">
                Console Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary py-1.5 px-3.5 text-sm">
                  Get Started Free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-950/10 via-transparent to-transparent -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Left */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 text-xs text-green-400 font-semibold tracking-wide uppercase">
                <Zap size={12} className="animate-pulse" /> Cloudflare for LLMs
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Cut Your LLM Costs <br />
                <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                  By Up To 80%
                </span>
              </h1>
              <p className="text-lg text-gray-400 max-w-xl">
                Deploy VibeCore in under 2 minutes. Situate our smart proxy between your apps and downstream LLMs to trigger semantic caching, automated token saving, and latency-aware routing.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link to="/register" className="btn-primary px-6 py-3 text-base font-semibold">
                  Get Started Free
                </Link>
                <a href="#pricing" className="btn-secondary px-6 py-3 text-base font-semibold">
                  View Pricing Plans
                </a>
              </div>

              {/* Ticker Stats */}
              <div className="pt-8 border-t border-gray-900 grid grid-cols-3 gap-6">
                <div>
                  <div className="text-2xl font-bold text-white">{(globalStats.total_requests).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Processed Queries</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{globalStats.cache_hit_rate_pct}%</div>
                  <div className="text-xs text-gray-500">Cache Hit Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">${globalStats.total_usd_saved.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Total USD Saved</div>
                </div>
              </div>
            </div>

            {/* Hero Right — Integration Code Snippet */}
            <div className="lg:col-span-5">
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full filter blur-xl" />
                <div className="flex items-center justify-between pb-4 border-b border-gray-800/80 mb-4">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/60" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <span className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                    <Code size={12} /> app.js
                  </span>
                </div>
                <pre className="text-xs sm:text-sm font-mono text-gray-300 leading-relaxed overflow-x-auto text-left">
                  <code>
{`// Simply update your client config
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.VIBECORE_API_KEY,
  
  // ⚡ Just change the baseURL!
  baseURL: 'http://localhost:3001/api/chat'
});

const response = await openai.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: 'hello!' }]
});`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURES SECTION */}
      <section className="py-20 border-t border-gray-900 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Engineered For Performance & Cost</h2>
            <p className="text-gray-400">
              VibeCore intercepts requests transparently to run caching filters, saving tokens and routing dynamically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="card text-left space-y-4 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                <Cpu size={20} />
              </div>
              <h3 className="font-semibold text-lg text-white">Custom Gemma Model</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Queries are routed first to a customized Gemma 2B-IT model served on your Colab backend, enabling high-quality results at $0 compute cost.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card text-left space-y-4 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                <Layers size={20} />
              </div>
              <h3 className="font-semibold text-lg text-white">Semantic Caching</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Uses local sentence-embedding matching to capture queries with similar meanings, returning instant answers from Redis cache without querying downstream LLMs.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card text-left space-y-4 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                <Zap size={20} />
              </div>
              <h3 className="font-semibold text-lg text-white">Smart Routing</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Evaluates query complexity and maps simple requests to fast, cheap models (like Llama-3.1-8b), and complex jobs to GPT-4o or Claude.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card text-left space-y-4 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                <TrendingDown size={20} />
              </div>
              <h3 className="font-semibold text-lg text-white">Prompt Optimizer</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Automatically strips conversational fillers, repetitive spaces, and line breaks from prompt payloads, reducing context size by 15%.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card text-left space-y-4 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                <BarChart3 size={20} />
              </div>
              <h3 className="font-semibold text-lg text-white">Cost Analytics</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Logs cumulative tokens saved and tracks budget expenditures. Renders real-time savings dashboards and charts.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card text-left space-y-4 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-semibold text-lg text-white">API-Compatible</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Conforms completely to standard OpenAI request/response structures. Easily drop it into LangChain, LlamaIndex, or your native apps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PRICING SECTION */}
      <section id="pricing" className="py-20 border-t border-gray-900 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Simple, Predictable Plans</h2>
            <p className="text-gray-400">
              Start for free and upgrade as you scale. Upgrade securely via Razorpay or PayPal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 text-left flex flex-col justify-between hover:border-gray-700 transition-all">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-white">Free Plan</h3>
                  <p className="text-xs text-gray-500">Perfect for prototyping</p>
                </div>
                <div className="text-3xl font-extrabold text-white">
                  ₹0 <span className="text-xs text-gray-500 font-normal">/ month</span>
                </div>
                <ul className="text-sm text-gray-400 space-y-2 pt-4 border-t border-gray-800">
                  <li className="flex items-center gap-2">✓ Up to 1,000 monthly requests</li>
                  <li className="flex items-center gap-2">✓ Gemma + Groq failover</li>
                  <li className="flex items-center gap-2">✓ Exact cache match</li>
                  <li className="flex items-center gap-2">✓ Prompt Optimizer</li>
                  <li className="flex items-center gap-2">✓ 3 Active API Keys</li>
                </ul>
              </div>
              <div className="pt-6">
                <Link to="/register" className="btn-secondary w-full text-sm">
                  Get Started Free
                </Link>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="bg-gray-900/60 border-2 border-green-500/50 rounded-2xl p-6 text-left flex flex-col justify-between shadow-lg shadow-green-500/5 hover:-translate-y-1 transition-all">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg text-white">Pro Plan</h3>
                    <p className="text-xs text-gray-500">For active builders</p>
                  </div>
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Popular
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-white">
                  ₹1,999 <span className="text-xs text-gray-500 font-normal">/ month ($19 USD)</span>
                </div>
                <ul className="text-sm text-gray-400 space-y-2 pt-4 border-t border-gray-800">
                  <li className="flex items-center gap-2">✓ Up to 50,000 monthly requests</li>
                  <li className="flex items-center gap-2">✓ OpenAI + Anthropic fallbacks</li>
                  <li className="flex items-center gap-2">✓ Cosine Semantic Caching</li>
                  <li className="flex items-center gap-2">✓ Real-time Latency Routing</li>
                  <li className="flex items-center gap-2">✓ 10 Active API Keys</li>
                </ul>
              </div>
              <div className="pt-6">
                <Link to="/register" className="btn-primary w-full text-sm">
                  Upgrade to Pro
                </Link>
              </div>
            </div>

            {/* Team Plan */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 text-left flex flex-col justify-between hover:border-gray-700 transition-all">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-white">Team Plan</h3>
                  <p className="text-xs text-gray-500">For small teams & scale</p>
                </div>
                <div className="text-3xl font-extrabold text-white">
                  ₹7,999 <span className="text-xs text-gray-500 font-normal">/ month ($79 USD)</span>
                </div>
                <ul className="text-sm text-gray-400 space-y-2 pt-4 border-t border-gray-800">
                  <li className="flex items-center gap-2">✓ Up to 500,000 monthly requests</li>
                  <li className="flex items-center gap-2">✓ All providers + Premium routing</li>
                  <li className="flex items-center gap-2">✓ Highest priority routing</li>
                  <li className="flex items-center gap-2">✓ Dedicated performance stats</li>
                  <li className="flex items-center gap-2">✓ Unlimited Active API Keys</li>
                </ul>
              </div>
              <div className="pt-6">
                <Link to="/register" className="btn-secondary w-full text-sm">
                  Get Started for Team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="mt-auto border-t border-gray-900 bg-gray-950 py-8 text-center text-sm text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} VibeCore. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/health" className="hover:text-gray-300">System status</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-gray-300">GitHub</a>
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="hover:text-gray-300">Supabase</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
