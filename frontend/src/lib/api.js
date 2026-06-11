import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase client not fully configured in frontend env vars.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function apiFetch(path, options = {}) {
  // Retrieve token from active Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${apiUrl}${cleanPath}`, {
    ...options,
    headers
  });

  let body = {};
  try {
    body = await response.json();
  } catch (err) {
    // Response not JSON
  }

  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }

  return body;
}
