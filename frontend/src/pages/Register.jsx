import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/api';
import { ArrowRight, Mail, Lock } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Register user via custom backend to auto-generate default API key
      const response = await fetch('http://localhost:3001/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Registration failed');
      }

      // 2. Sign in immediately to create local session
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        throw signInError;
      }

      // 3. Stash the newly generated key temporarily to show it in the Dashboard
      if (body.apiKey) {
        sessionStorage.setItem('vc_newly_created_key', body.apiKey);
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'An unexpected registration error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute w-[400px] h-[400px] bg-green-500/5 rounded-full filter blur-3xl -z-10" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight text-white mb-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center text-gray-950 font-black shadow-md shadow-green-500/20">
              V
            </div>
            <span>Vibe<span className="text-green-400">Core</span></span>
          </Link>
          <p className="text-gray-400 text-sm">Create an account. Get your keys and start optimizing costs.</p>
        </div>

        {/* Form Card */}
        <div className="card bg-gray-900 border-gray-800/80 p-8 shadow-xl">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="name@company.com"
                  className="input w-full pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="•••••••• (6+ characters)"
                  className="input w-full pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-2 font-semibold text-sm"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  Create Free Account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-green-400 hover:text-green-300 font-medium hover:underline">
              Sign In here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
