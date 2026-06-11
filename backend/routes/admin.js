import express from 'express';
import { supabase } from '../supabase.js';
import { validateApiKeyOrJwt, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middlewares globally to all admin routes
router.use(validateApiKeyOrJwt);
router.use(adminOnly);

router.get('/stats', async (req, res) => {
  try {
    const { count: totalUsers, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    const { data: globalStats, error: statsError } = await supabase
      .from('global_stats')
      .select('*')
      .single();

    if (statsError) throw statsError;

    return res.json({
      total_users: totalUsers || 0,
      total_requests: globalStats?.total_requests || 0,
      total_tokens_saved: globalStats?.total_tokens_saved || 0,
      total_usd_saved: parseFloat(globalStats?.total_usd_saved || 0),
      cache_hit_rate_pct: parseFloat(globalStats?.cache_hit_rate_pct || 0)
    });
  } catch (error) {
    console.error('Failed to retrieve admin stats:', error);
    return res.status(500).json({ error: 'Failed to aggregate global system stats metrics' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('Failed to retrieve profiles list:', error);
    return res.status(500).json({ error: 'Failed to query user profile registry' });
  }
});

router.patch('/users/:id/plan', async (req, res) => {
  const { id } = req.params;
  const { plan } = req.body;

  if (!plan || !['free', 'pro', 'team', 'enterprise'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ message: 'User billing plan updated successfully', profile: data });
  } catch (error) {
    console.error('Failed to update plan:', error);
    return res.status(500).json({ error: 'Failed to update user profile plan tier' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Cascade delete of user accounts from Supabase Auth directory
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    return res.json({ message: 'User deleted successfully from auth directory' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return res.status(500).json({ error: 'Failed to delete user account registry' });
  }
});

export default router;
