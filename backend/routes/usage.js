import express from 'express';
import { supabase } from '../supabase.js';
import { validateApiKeyOrJwt } from '../middleware/auth.js';

const router = express.Router();

router.get('/', validateApiKeyOrJwt, async (req, res) => {
  const userId = req.user.id;

  try {
    // Basic stats
    const { data: logs, error: logsError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    const totalRequests = logs.length;
    const cacheHits = logs.filter(l => l.cache_hit).length;
    const tokensSaved = logs.reduce((acc, l) => acc + (l.tokens_saved || 0), 0);
    const costSavedUsd = logs.reduce((acc, l) => acc + Number(l.saved_usd || 0), 0);

    // Recent requests
    const recentRequests = logs.slice(0, 20).map(l => ({
      id: l.id,
      timestamp: l.created_at,
      promptPreview: l.original_tokens ? `Request with ${l.original_tokens} tokens` : 'Request',
      model: l.model_used,
      cacheType: l.cache_type,
      savedUsd: l.saved_usd
    }));

    // Daily stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: dailyData, error: dailyError } = await supabase
      .rpc('get_daily_stats', { user_id_param: userId });

    if (dailyError) console.error('Daily stats error:', dailyError);

    return res.json({
      totalRequests,
      cacheHits,
      tokensSaved,
      costSavedUsd,
      requestsThisMonth: req.user.requests_this_month,
      planLimit: req.user.plan === 'free' ? 1000 : (req.user.plan === 'pro' ? 50000 : 'Unlimited'),
      recentRequests,
      dailyStats: dailyData || []
    });

  } catch (error) {
    console.error('Usage fetch error:', error);
    return res.status(500).json({ error: 'failed_to_fetch_usage' });
  }
});

router.get('/global', async (req, res) => {
  const { data, error } = await supabase.from('global_stats').select('*').single();
  if (error) return res.status(500).json({ error: 'failed_to_fetch_global_stats' });
  return res.json(data);
});

export default router;
