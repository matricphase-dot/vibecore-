import express from 'express';
import { supabase } from '../supabase.js';
import { cache } from '../lib/cache.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const checks = {
    supabase:  false,
    cache:     'in-memory',
    gemma:     process.env.GEMMA_BASE_URL     ? 'configured' : 'not_configured',
    openai:    process.env.OPENAI_API_KEY     ? 'configured' : 'not_configured',
    groq:      process.env.GROQ_API_KEY       ? 'configured' : 'not_configured',
    anthropic: process.env.ANTHROPIC_API_KEY  ? 'configured' : 'not_configured'
  };

  try {
    // 1. Check Supabase by querying profiles table
    const { error: dbError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    checks.supabase = !dbError;
    if (dbError) console.error('Health → Supabase error:', dbError.message);

    // 2. Cache stats (always healthy — in-memory)
    const stats = cache.stats();
    checks.cache = `in-memory (${stats.kv_keys} kv, ${stats.set_keys} sets)`;

    // 3. Check Gemma endpoint (5s timeout)
    if (process.env.GEMMA_BASE_URL) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      try {
        const r = await fetch(
          `${process.env.GEMMA_BASE_URL.replace(/\/$/, '')}/health`,
          { signal: controller.signal }
        );
        if (r.ok) {
          const body = await r.json();
          checks.gemma = `healthy (${body.model || 'gemma'})`;
        } else {
          checks.gemma = `degraded (status: ${r.status})`;
        }
      } catch (e) {
        checks.gemma = `offline (${e.message})`;
      } finally {
        clearTimeout(tid);
      }
    }

    const healthy = checks.supabase;
    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(503).json({
      status: 'degraded',
      error: error.message,
      checks,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
