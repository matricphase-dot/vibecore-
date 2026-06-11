import crypto from 'crypto';
import { supabase } from '../supabase.js';

export async function validateApiKeyOrJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    // 1. API Key Auth (Starts with "vc-")
    if (token.startsWith('vc-')) {
      const keyHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('*, profiles:user_id(*)')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

      if (keyError || !keyData || !keyData.profiles) {
        return res.status(401).json({ error: 'Invalid or deactivated API Key' });
      }

      req.user = {
        id: keyData.profiles.id,
        plan: keyData.profiles.plan,
        keyId: keyData.id,
        isAdmin: keyData.profiles.is_admin,
        authType: 'apikey'
      };

      return next();
    }

    // 2. Supabase JWT Authentication
    const { data: { user }, error: jwtError } = await supabase.auth.getUser(token);
    if (jwtError || !user) {
      return res.status(401).json({ error: 'Invalid or expired user session token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile registry not found' });
    }

    req.user = {
      id: profile.id,
      plan: profile.plan,
      isAdmin: profile.is_admin,
      authType: 'jwt'
    };

    return next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Internal validation server error' });
  }
}

export function adminOnly(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin credentials required' });
  }
  next();
}
