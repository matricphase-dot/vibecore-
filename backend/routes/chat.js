import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateApiKeyOrJwt } from '../middleware/auth.js';
import { checkPlanRateLimit } from '../middleware/rateLimit.js';
import { optimize } from '../lib/optimizer.js';
import { classify } from '../lib/classifier.js';
import { getExact, setExact, getSemantic, setSemantic } from '../lib/semanticCache.js';
import { route } from '../lib/router.js';
import { calculate } from '../lib/costTracker.js';
import { supabase } from '../supabase.js';

const router = express.Router();

// Apply auth middleware globally to chat routes
router.use(validateApiKeyOrJwt);

router.post('/completions', checkPlanRateLimit, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages array format' });
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || !lastMessage.content) {
    return res.status(400).json({ error: 'Last message content cannot be empty' });
  }

  const originalPrompt = lastMessage.content;

  try {
    // 1. Optimize the prompt
    const optResult = optimize(originalPrompt);
    const optimizedPrompt = optResult.optimized;
    const originalTokens = optResult.originalTokens;
    const optimizedTokens = optResult.optimizedTokens;
    const savedTokens = optResult.savedTokens;

    // 2. Classify prompt complexity
    const complexity = classify(optimizedPrompt);

    // 3. Exact Cache check
    const exactHit = await getExact(optimizedPrompt);
    if (exactHit) {
      const savings = calculate({
        promptTokens: originalTokens,
        completionTokens: 0,
        costPer1kTokens: 0
      });

      res.set({
        'x-vibecore': 'true',
        'x-cache': 'exact',
        'x-provider': 'cache',
        'x-latency-ms': '10',
        'x-cost-saved-usd': savings.savedCostUsd.toString(),
        'x-tokens-saved': originalTokens.toString()
      });

      // Log to database and increment request counter (non-blocking)
      supabase.from('usage_logs').insert({
        user_id: req.user.id,
        api_key_id: req.user.keyId || null,
        prompt_preview: originalPrompt.substring(0, 120),
        model_used: 'cache',
        provider: 'cache',
        cache_hit: 'exact',
        complexity,
        baseline_tokens: originalTokens,
        actual_tokens: 0,
        tokens_saved: originalTokens,
        baseline_cost_usd: savings.baselineCostUsd,
        actual_cost_usd: 0,
        cost_saved_usd: savings.savedCostUsd,
        latency_ms: 10
      }).then(({ error }) => {
        if (error) console.error('Error writing exact cache usage log:', error);
      });

      Promise.resolve(supabase.rpc('increment_request_count', {
        p_user_id: req.user.id,
        p_api_key_id: req.user.keyId || null
      })).catch(err => console.error('Error incrementing request count:', err));

      return res.json({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'cache',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: exactHit
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    }

    // 4. Semantic Cache check
    const semanticHit = await getSemantic(optimizedPrompt);
    if (semanticHit) {
      const savings = calculate({
        promptTokens: originalTokens,
        completionTokens: 0,
        costPer1kTokens: 0
      });

      res.set({
        'x-vibecore': 'true',
        'x-cache': 'semantic',
        'x-provider': 'cache',
        'x-latency-ms': '20',
        'x-cost-saved-usd': savings.savedCostUsd.toString(),
        'x-tokens-saved': originalTokens.toString()
      });

      // Log to database and increment request counter (non-blocking)
      supabase.from('usage_logs').insert({
        user_id: req.user.id,
        api_key_id: req.user.keyId || null,
        prompt_preview: originalPrompt.substring(0, 120),
        model_used: 'cache',
        provider: 'cache',
        cache_hit: 'semantic',
        complexity,
        baseline_tokens: originalTokens,
        actual_tokens: 0,
        tokens_saved: originalTokens,
        baseline_cost_usd: savings.baselineCostUsd,
        actual_cost_usd: 0,
        cost_saved_usd: savings.savedCostUsd,
        latency_ms: 20
      }).then(({ error }) => {
        if (error) console.error('Error writing semantic cache usage log:', error);
      });

      Promise.resolve(supabase.rpc('increment_request_count', {
        p_user_id: req.user.id,
        p_api_key_id: req.user.keyId || null
      })).catch(err => console.error('Error incrementing request count:', err));

      return res.json({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'cache',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: semanticHit
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    }

    // 5. Cache Miss -> Route request to provider chain
    const routedMessages = [...messages];
    routedMessages[routedMessages.length - 1] = {
      role: 'user',
      content: optimizedPrompt
    };

    const routeResult = await route(routedMessages, req.user.plan, complexity);
    const { content, provider, model, promptTokens, completionTokens, latencyMs, costPer1kTokens } = routeResult;

    // Calculate actual vs baseline savings
    const savings = calculate({
      promptTokens: promptTokens,
      completionTokens: completionTokens,
      costPer1kTokens
    });

    res.set({
      'x-vibecore': 'true',
      'x-cache': 'miss',
      'x-provider': provider,
      'x-latency-ms': latencyMs.toString(),
      'x-cost-saved-usd': savings.savedCostUsd.toString(),
      'x-tokens-saved': (savedTokens + (originalTokens - promptTokens)).toString()
    });

    // Populate exact + semantic cache (non-blocking)
    setExact(optimizedPrompt, content).catch(err => console.error('Exact cache set error:', err));
    setSemantic(optimizedPrompt, content).catch(err => console.error('Semantic cache set error:', err));

    // Log request and increment count (non-blocking)
    supabase.from('usage_logs').insert({
      user_id: req.user.id,
      api_key_id: req.user.keyId || null,
      prompt_preview: originalPrompt.substring(0, 120),
      model_used: model,
      provider: provider,
      cache_hit: 'miss',
      complexity,
      baseline_tokens: originalTokens,
      actual_tokens: promptTokens + completionTokens,
      tokens_saved: Math.max(0, originalTokens - promptTokens) + savedTokens,
      baseline_cost_usd: savings.baselineCostUsd,
      actual_cost_usd: savings.actualCostUsd,
      cost_saved_usd: savings.savedCostUsd,
      latency_ms: latencyMs
    }).then(({ error }) => {
      if (error) console.error('Error writing usage log:', error);
    });

    Promise.resolve(supabase.rpc('increment_request_count', {
      p_user_id: req.user.id,
      p_api_key_id: req.user.keyId || null
    })).catch(err => console.error('Error incrementing request count:', err));

    return res.json({
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    });

  } catch (error) {
    console.error('Chat completions route failure:', error);
    return res.status(500).json({ error: error.message || 'All underlying models failed to respond.' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_daily_stats', {
      p_user_id: req.user.id
    });
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (error) {
    console.error('Failed to get daily stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve usage stats profile' });
  }
});

router.get('/logs', async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  try {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    return res.status(500).json({ error: 'Failed to query request log registry' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('usage_logs')
      .select('cache_hit, tokens_saved, cost_saved_usd')
      .eq('user_id', req.user.id);

    if (error) throw error;

    const totalRequests = logs.length;
    const hits = logs.filter(l => l.cache_hit && l.cache_hit !== 'miss').length;
    const cacheHitRatePct = totalRequests > 0 
      ? parseFloat(((hits / totalRequests) * 100).toFixed(2)) 
      : 0;

    const totalTokensSaved = logs.reduce((sum, l) => sum + (l.tokens_saved || 0), 0);
    const totalUsdSaved = logs.reduce((sum, l) => sum + parseFloat(l.cost_saved_usd || 0), 0);

    return res.json({
      total_requests: totalRequests,
      cache_hit_rate_pct: cacheHitRatePct,
      total_tokens_saved: totalTokensSaved,
      total_usd_saved: parseFloat(totalUsdSaved.toFixed(6))
    });
  } catch (error) {
    console.error('Failed to retrieve stats summary:', error);
    return res.status(500).json({ error: 'Failed to generate metrics summary card' });
  }
});

export default router;
