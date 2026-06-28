import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, supabase } from '../lib/api';
import { ArrowLeft, RefreshCw, Activity, CheckCircle2, AlertTriangle, CloudRain } from 'lucide-react';

export default function Health({ session }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const navigate = useNavigate();

  const fetchHealth = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/health');
      setHealth(data);
    } catch (err) {
      setError(err.message || 'Failed to query cluster health status API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!session) {
        navigate('/login');
        return;
      }
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        if (profileError || !data || !data.is_admin) {
          navigate('/dashboard');
        } else {
          setIsAdmin(true);
          setVerifying(false);
          fetchHealth();
        }
      } catch (err) {
        navigate('/dashboard');
      }
    };
    verifyAdmin();
  }, [session, navigate]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-400"></div>
        <p className="text-xs text-gray-500 font-mono">Verifying authorization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12 relative overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute w-[500px] h-[500px] bg-green-500/5 rounded-full filter blur-3xl -z-10 top-0 left-0" />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Action Row */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Status
          </button>
        </div>

        {/* Brand & Health Title */}
        <div className="text-left space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity className="text-green-400" /> VibeCore System Health
          </h1>
          <p className="text-gray-400 text-sm">Real-time status indicators checking the connectivity and credentials of external dependency services.</p>
        </div>

        {/* Global status summary */}
        {loading ? (
          <div className="card py-12 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-400"></div>
            <p className="text-xs text-gray-500 font-mono">Asserting backend connections...</p>
          </div>
        ) : error ? (
          <div className="card border-red-500/30 bg-red-500/5 text-left p-6 space-y-2">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle size={18} /> API Health Query Failed
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{error}</p>
            <p className="text-xs text-gray-500 font-mono">Ensure your Express backend server is active on port 3001 and database connections are validated.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Summary Banner */}
            <div className={`card border-l-4 p-6 flex items-center gap-4 ${
              health?.status === 'healthy' 
                ? 'border-l-green-500 bg-green-500/5' 
                : 'border-l-yellow-500 bg-yellow-500/5'
            }`}>
              {health?.status === 'healthy' ? (
                <CheckCircle2 size={36} className="text-green-400 shrink-0" />
              ) : (
                <AlertTriangle size={36} className="text-yellow-400 shrink-0" />
              )}
              <div className="text-left">
                <h3 className="font-bold text-lg text-white uppercase tracking-wider">
                  Cluster Status: {health?.status || 'Degraded'}
                </h3>
                <p className="text-xs text-gray-400">
                  {health?.status === 'healthy' 
                    ? 'All essential core services are online, verified, and operational.' 
                    : 'Some secondary integrations or external provider credentials are degraded/unconfigured.'}
                </p>
              </div>
            </div>

            {/* Individual services grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supabase Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">PostgreSQL (Supabase)</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.supabase 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {health?.checks?.supabase ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Stores core profile registries, developer API keys, and comprehensive usage logs.</p>
              </div>

              {/* Cache Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">Memory Cache</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.cache?.startsWith('in-memory')
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {health?.checks?.cache?.startsWith('in-memory') ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">High-speed local cache handling exact matching keys and indices. Status: <span className="font-mono text-gray-300">{health?.checks?.cache}</span></p>
              </div>

              {/* Gemma Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">Custom Gemma Model (Colab)</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.gemma?.startsWith('healthy')
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : health?.checks?.gemma === 'not_configured'
                      ? 'bg-gray-800 text-gray-400'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {health?.checks?.gemma?.startsWith('healthy') ? 'Healthy' : health?.checks?.gemma === 'not_configured' ? 'Not Configured' : 'Degraded'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Primary zero-cost inference server tunnel. Status: <span className="font-mono text-gray-300">{health?.checks?.gemma}</span>.</p>
              </div>

              {/* OpenAI Provider Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">OpenAI Integration</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.openai === 'configured'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {health?.checks?.openai === 'configured' ? 'Configured' : 'Not Loaded'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Fallback models powering standard completions. Relies on `OPENAI_API_KEY` configurations.</p>
              </div>

              {/* Groq Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">Groq Cloud Provider</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.groq === 'configured'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {health?.checks?.groq === 'configured' ? 'Configured' : 'Not Loaded'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Provides high-performance Llama inference fallbacks. Relies on `GROQ_API_KEY` configurations.</p>
              </div>

              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">Anthropic Claude Integration</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.anthropic === 'configured'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {health?.checks?.anthropic === 'configured' ? 'Configured' : 'Not Loaded'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Premium fallback models powering Claude completions. Relies on `ANTHROPIC_API_KEY` configurations.</p>
              </div>

              {/* Razorpay Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">Razorpay Gateway (INR)</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.razorpay === 'configured'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {health?.checks?.razorpay === 'configured' ? 'Configured' : 'Mock Mode'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Processes domestic payments and upgrades. Relies on `RAZORPAY_KEY_ID` and webhook secrets.</p>
              </div>

              {/* PayPal Card */}
              <div className="card text-left space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">PayPal Gateway (USD)</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    health?.checks?.paypal === 'configured'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {health?.checks?.paypal === 'configured' ? 'Configured' : 'Mock Mode'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Processes international payments and upgrades. Relies on `PAYPAL_CLIENT_ID` configurations.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
