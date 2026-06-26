import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// Temporary diagnostic endpoint — remove before final production
router.post('/diagnose', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  // Step 1: getUser
  const { data: { user }, error: jwtError } = await supabase.auth.getUser(token);
  if (jwtError || !user) {
    return res.json({ step: 'getUser', error: jwtError?.message, user: null });
  }

  // Step 2: Profile lookup
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  return res.json({
    step: 'profileLookup',
    user_id: user.id,
    user_email: user.email,
    profile_found: !!profile,
    profile_error: profileError?.message || null,
    profile: profile || null
  });
});

export default router;
