import { supabase } from '../supabase.js';

const PLAN_LIMITS = {
  free: 1000,
  pro: 50000,
  team: 500000,
  enterprise: Infinity
};

export async function checkPlanRateLimit(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'User context not found' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('monthly_requests, month_reset_at, plan')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(500).json({ error: 'Failed to retrieve profile usage limits' });
    }

    let monthlyRequests = profile.monthly_requests || 0;
    const now = new Date();
    const resetAt = profile.month_reset_at ? new Date(profile.month_reset_at) : null;

    // Auto-reset check if billing cycle reset date has passed
    if (resetAt && now > resetAt) {
      const nextResetDate = new Date();
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      const { error: resetError } = await supabase
        .from('profiles')
        .update({
          monthly_requests: 0,
          month_reset_at: nextResetDate.toISOString()
        })
        .eq('id', req.user.id);

      if (!resetError) {
        monthlyRequests = 0;
      } else {
        console.error('Failed to reset monthly requests count:', resetError);
      }
    }

    const limit = PLAN_LIMITS[profile.plan] || 1000;

    if (monthlyRequests >= limit) {
      return res.status(429).json({
        error: 'Monthly request limit exceeded for your current plan tier.',
        limit: limit === Infinity ? 'Unlimited' : limit,
        current: monthlyRequests,
        plan: profile.plan,
        upgrade_url: '/dashboard'
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    return res.status(500).json({ error: 'Internal rate-limiting validation error' });
  }
}
