import express from 'express';
import crypto from 'crypto';
import { supabase, getAuthClient } from '../supabase.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError ? authError.message : 'Registration failed' });
    }

    const user = authData.user;

    // Create profile row (may already exist via Supabase trigger, upsert to be safe)
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      is_admin: false,
      plan: 'free'
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Failed to create profile for user:', profileError);
    }

    // Generate Initial API Key (20 random bytes as hex = 40 chars)
    const rawKey = `vc-${crypto.randomBytes(20).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const { error: keyError } = await supabase.from('api_keys').insert({
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: 'Default Key',
      is_active: true
    });

    if (keyError) {
      console.error('Failed to create default API Key for user:', JSON.stringify(keyError));
      // Still return success but without apiKey so user knows to create one manually
      return res.json({ user, apiKey: null, warning: 'Account created but API key generation failed. Please create one from the dashboard.' });
    }

    return res.json({
      user,
      apiKey: rawKey
    });
  } catch (error) {
    console.error('Signup route error:', error);
    return res.status(500).json({ error: 'Internal signup operation failure' });
  }
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await getAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ error: error ? error.message : 'Invalid login credentials' });
    }

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user
    });
  } catch (error) {
    console.error('Signin route error:', error);
    return res.status(500).json({ error: 'Internal signin operation failure' });
  }
});

router.post('/signout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await getAuthClient().auth.signOut(token);
    }
  } catch (error) {
    console.error('Signout error:', error);
  }
  return res.json({ message: 'logged_out' });
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const { data, error } = await getAuthClient().auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      return res.status(401).json({ error: error ? error.message : 'Invalid or expired refresh token' });
    }

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user
    });
  } catch (error) {
    console.error('Session refresh route error:', error);
    return res.status(500).json({ error: 'Internal session refresh failure' });
  }
});

export default router;
