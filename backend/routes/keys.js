import express from 'express';
import crypto from 'crypto';
import { supabase } from '../supabase.js';
import { validateApiKeyOrJwt } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware globally to keys routes
router.use(validateApiKeyOrJwt);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_prefix, label, is_active, total_requests, last_used_at')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('Failed to list API Keys:', error);
    return res.status(500).json({ error: 'Failed to query API key registry' });
  }
});

router.post('/', async (req, res) => {
  const { label } = req.body;

  try {
    // 1. Fetch current profile plan to verify limits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Failed to retrieve profile billing plan' });
    }

    // 2. Query count of current active keys
    const { count, error: countError } = await supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_active', true);

    if (countError) {
      return res.status(500).json({ error: 'Failed to count active API keys' });
    }

    // 3. Enforce key limits
    const limits = {
      free: 3,
      pro: 10,
      team: Infinity,
      enterprise: Infinity
    };
    const maxKeys = limits[profile.plan] || 3;

    if (count >= maxKeys) {
      return res.status(403).json({
        error: `Key generation limit reached. Your current plan (${profile.plan}) allows a maximum of ${maxKeys === Infinity ? 'Unlimited' : maxKeys} active keys. Please upgrade.`
      });
    }

    // 4. Generate new API Key
    const rawKey = `vc-${crypto.randomBytes(20).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 8);

    const { data, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        user_id: req.user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: label || 'Default Key',
        is_active: true
      })
      .select('id, key_prefix, label, is_active, total_requests, last_used_at')
      .single();

    if (insertError) throw insertError;

    return res.json({
      key: rawKey,
      warning: 'Store this key safely. It will NOT be shown again in the interface.',
      apiKey: data
    });
  } catch (error) {
    console.error('Failed to create API Key:', error);
    return res.status(500).json({ error: 'Internal API Key generation failure' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return res.json({ message: 'key_deactivated' });
  } catch (error) {
    console.error('Failed to deactivate API Key:', error);
    return res.status(500).json({ error: 'Failed to deactivate API Key registry record' });
  }
});

export default router;
