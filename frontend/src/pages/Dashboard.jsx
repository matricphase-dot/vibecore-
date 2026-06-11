import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, apiFetch } from '../lib/api';
import { 
  BarChart3, Key, ShieldCheck, HeartPulse, LogOut, 
  Layers, Zap, Coins, Copy, Check, Trash2, ArrowUpRight, 
  Terminal, ShieldAlert
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Dashboard({ session }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({
    total_requests: 0,
    cache_hit_rate_pct: 0,
    total_tokens_saved: 0,
    total_usd_saved: 0.00
  });
  const [stats, setStats] = useState([]);
  const [logs, setLogs] = useState([]);
  const [keys, setKeys] = useState([]);

  // Form State
  const [keyLabel, setKeyLabel] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Load profile & key checks
  useEffect(() => {
    fetchProfile();
    fetchSummary();
    fetchStats();
    fetchLogs();
    fetchKeys();

    // Check if there is a stashed key from registration
    const stashedKey = sessionStorage.getItem('vc_newly_created_key');
    if (stashedKey) {
      setNewlyCreatedKey(stashedKey);
      sessionStorage.removeItem('vc_newly_created_key');
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await apiFetch('/api/chat/summary');
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary stats:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await apiFetch('/api/chat/stats');
      setStats(data || []);
    } catch (err) {
      console.error('Failed to load daily stats:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data } = await apiFetch('/api/chat/logs?limit=50');
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const fetchKeys = async () => {
    try {
      const data = await apiFetch('/api/keys');
      setKeys(data || []);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Create API Key
  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!keyLabel.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ label: keyLabel })
      });
      setNewlyCreatedKey(res.key);
      setKeyLabel('');
      setSuccess('API key generated successfully!');
      fetchKeys();
    } catch (err) {
      setError(err.message || 'Failed to generate API Key');
    } finally {
      setLoading(false);
    }
  };

  // Revoke API Key
  const handleRevokeKey = async (keyId) => {
    if (!confirm('Are you sure you want to deactivate this API key? This action is permanent.')) return;
    try {
      await apiFetch(`/api/keys/${keyId}`, { method: 'DELETE' });
      fetchKeys();
    } catch (err) {
      alert(err.message || 'Failed to deactivate key');
    }
  };

  // Checkout Upgrade (Razorpay/PayPal mock triggers)
  const handleUpgrade = async (plan, gateway) => {
    try {
      setLoading(true);
      if (gateway === 'razorpay') {
        const order = await apiFetch('/api/payments/razorpay/order', {
          method: 'POST',
          body: JSON.stringify({ plan })
        });
        
        // Simulating Razorpay SDK flow in standard browser
        // In real integration, we load window.Razorpay checkout modal
        alert(`Razorpay checkout started. Order ID: ${order.orderId}. Simulating payment capture webhook upgrading you to ${plan}...`);
        
        // Call webhook directly or mock capture callback locally
        const verifyRes = await fetch('http://localhost:3001/api/payments/razorpay/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-razorpay-signature': 'webhook-signature-mock-verification',
            'x-razorpay-event-id': `event_${Date.now()}`
          },
          body: JSON.stringify({
            event: 'payment.captured',
            id: `evt_${Date.now()}`,
            payload: {
              payment: {
                entity: {
                  notes: {
                    userId: session.user.id,
                    plan
                  }
                }
              }
            }
          })
        });

        if (verifyRes.ok) {
          alert('Plan upgraded successfully! Refreshing dashboard...');
          fetchProfile();
        } else {
          alert('Webhook verification failed locally.');
        }

      } else {
        // PayPal Flow
        const order = await apiFetch('/api/payments/paypal/order', {
          method: 'POST',
          body: JSON.stringify({ plan })
        });

        alert(`PayPal transaction started. Order ID: ${order.orderId}. Simulating capture callback...`);

        const verifyRes = await fetch('http://localhost:3001/api/payments/paypal/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `paypal_evt_${Date.now()}`,
            event_type: 'PAYMENT.CAPTURE.COMPLETED',
            resource: {
              custom_id: JSON.stringify({
                userId: session.user.id,
                plan
              })
            }
          })
        });

        if (verifyRes.ok) {
          alert('Plan upgraded successfully! Refreshing dashboard...');
          fetchProfile();
        } else {
          alert('Webhook simulation failed.');
        }
      }
    } catch (err) {
      alert(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  // Mock charts fallback if empty stats
  const chartData = stats.length > 0 ? stats : [
    { day: 'Mon', requests: 4 },
    { day: 'Tue', requests: 12 },
    { day: 'Wed', requests: 28 },
    { day: 'Thu', requests: 18 },
    { day: 'Fri', requests: 42 },
    { day: 'Sat', requests: 35 },
    { day: 'Sun', requests: 52 }
  ];

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* 1. SIDEBAR (w-56) */}
      <aside className="w-56 border-r border-gray-900 bg-gray-900/30 flex flex-col justify-between p-4 sticky top-0 h-screen">
        <div className="space-y-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-white mb-6">
            <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center text-gray-950 font-black">
              V
            </div>
            <span>Vibe<span className="text-green-400">Core</span></span>
          </Link>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'overview' ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <BarChart3 size={18} /> Overview
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'logs' ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <Terminal size={18} /> Request Logs
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'keys' ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <Key size={18} /> API Keys
            </button>
            <button
              onClick={() => navigate('/health')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-white transition-colors"
            >
              <HeartPulse size={18} /> System Health
            </button>
            {profile?.is_admin && (
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-white transition-colors"
              >
                <ShieldCheck size={18} /> Admin Dashboard
              </button>
            )}
          </nav>
        </div>

        {/* User profile details at bottom */}
        <div className="pt-4 border-t border-gray-900 space-y-3">
          <div className="px-2">
            <div className="text-xs text-gray-400 truncate font-medium">{session.user.email}</div>
            <div className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-1">
              Plan: {profile?.plan || 'free'}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-6">
        {/* Banner Alert for Free Users to Upgrade */}
        {profile?.plan === 'free' && (
          <div className="bg-gradient-to-r from-green-950/20 to-emerald-950/20 border border-green-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <h4 className="font-bold text-sm text-white">Upgrade to Pro to unlock Semantic Caching</h4>
              <p className="text-xs text-gray-400">Unlock OpenAI & Anthropic routing, real-time latency optimization, and raise limits to 50,000 monthly requests.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleUpgrade('pro', 'razorpay')} className="btn-primary py-1 px-3 text-xs">
                Pay INR (Razorpay)
              </button>
              <button onClick={() => handleUpgrade('pro', 'paypal')} className="btn-secondary py-1 px-3 text-xs">
                Pay USD (PayPal)
              </button>
            </div>
          </div>
        )}

        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary metrics grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                  <Zap size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Total Requests</div>
                  <div className="text-2xl font-bold text-white">{summary.total_requests}</div>
                </div>
              </div>
              
              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <Layers size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Cache Hit Rate</div>
                  <div className="text-2xl font-bold text-white">{summary.cache_hit_rate_pct}%</div>
                </div>
              </div>

              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Terminal size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Tokens Saved</div>
                  <div className="text-2xl font-bold text-white">{(summary.total_tokens_saved).toLocaleString()}</div>
                </div>
              </div>

              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Coins size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Total USD Saved</div>
                  <div className="text-2xl font-bold text-white">${summary.total_usd_saved.toFixed(4)}</div>
                </div>
              </div>
            </div>

            {/* Daily stats line chart */}
            <div className="card space-y-4">
              <div className="text-left">
                <h3 className="font-bold text-white text-base">Usage Stats (30 Days)</h3>
                <p className="text-xs text-gray-500">Number of queries run daily.</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} />
                    <Line type="monotone" dataKey="requests" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent requests table */}
            <div className="card space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <h3 className="font-bold text-white text-base">Recent Activity</h3>
                  <p className="text-xs text-gray-500">Last queries processed by proxy gateway.</p>
                </div>
                <button onClick={() => setActiveTab('logs')} className="text-green-400 hover:text-green-300 font-semibold text-xs flex items-center gap-1">
                  View full logs <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Preview</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3 text-right">Saved (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 8).map((log) => (
                      <tr key={log.id} className="border-b border-gray-900 hover:bg-gray-900/30 text-gray-300">
                        <td className="py-2.5 px-3">
                          {log.cache_hit === 'exact' && <span className="badge-hit">Hit (Exact)</span>}
                          {log.cache_hit === 'semantic' && <span className="badge-sem">Hit (Sem)</span>}
                          {log.cache_hit === 'miss' && <span className="badge-miss">Miss</span>}
                        </td>
                        <td className="py-2.5 px-3 truncate max-w-xs">{log.prompt_preview || 'No prompt content'}</td>
                        <td className="py-2.5 px-3 font-mono">{log.model_used || 'unknown'}</td>
                        <td className="py-2.5 px-3 text-right text-green-400 font-medium">${parseFloat(log.cost_saved_usd || 0).toFixed(6)}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">No requests recorded yet. Execute API calls to see activity.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick start code block */}
            <div className="card space-y-4 text-left">
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Quick Start Integration</h3>
                <p className="text-xs text-gray-500">Integrate VibeCore proxy into your code in minutes.</p>
              </div>
              <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-gray-300 relative border border-gray-900">
                <button 
                  onClick={() => copyToClipboard(`const OpenAI = require('openai');\nconst openai = new OpenAI({\n  apiKey: '${keys[0]?.key_prefix || 'vc-xxxxxxxx'}...', \n  baseURL: 'http://localhost:3001/api/chat'\n});`, 'snippet')}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
                >
                  {copiedSnippet ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
                <pre>
{`const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: '${keys[0] ? keys[0].key_prefix + '...' : 'YOUR_API_KEY'}',
  baseURL: 'http://localhost:3001/api/chat' // Redirect endpoint to VibeCore Proxy
});`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* --- REQUEST LOGS TAB --- */}
        {activeTab === 'logs' && (
          <div className="card space-y-4">
            <div className="text-left">
              <h3 className="font-bold text-white text-lg">Detailed Activity Logs</h3>
              <p className="text-xs text-gray-500 font-medium">Verify cache performance and token computations.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Cache</th>
                    <th className="py-3 px-3">Prompt Preview</th>
                    <th className="py-3 px-3">Provider</th>
                    <th className="py-3 px-3">Model</th>
                    <th className="py-3 px-3">Complexity</th>
                    <th className="py-3 px-3 text-right">Latency</th>
                    <th className="py-3 px-3 text-right">Saved (USD)</th>
                    <th className="py-3 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-900 hover:bg-gray-900/30 text-gray-300">
                      <td className="py-3 px-3">
                        {log.cache_hit === 'exact' && <span className="badge-hit">Exact</span>}
                        {log.cache_hit === 'semantic' && <span className="badge-sem">Semantic</span>}
                        {log.cache_hit === 'miss' && <span className="badge-miss">Miss</span>}
                      </td>
                      <td className="py-3 px-3 truncate max-w-[200px]">{log.prompt_preview}</td>
                      <td className="py-3 px-3 uppercase text-[10px] tracking-wider font-semibold text-gray-400">{log.provider || 'cache'}</td>
                      <td className="py-3 px-3 font-mono text-gray-400">{log.model_used || 'unknown'}</td>
                      <td className="py-3 px-3 uppercase text-[10px] font-medium">{log.complexity || 'simple'}</td>
                      <td className="py-3 px-3 text-right font-mono">{log.latency_ms}ms</td>
                      <td className="py-3 px-3 text-right text-green-400 font-semibold">${parseFloat(log.cost_saved_usd || 0).toFixed(6)}</td>
                      <td className="py-3 px-3 text-right text-gray-500 font-mono">{new Date(log.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">No requests matching profile yet. Make queries using SDK.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- API KEYS TAB --- */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            {/* Newly Created Key Alert Banner */}
            {newlyCreatedKey && (
              <div className="bg-gradient-to-r from-emerald-950/40 to-green-950/40 border border-green-500/30 rounded-xl p-5 space-y-3 text-left">
                <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                  <ShieldAlert size={18} /> API Key Created Successfully
                </div>
                <p className="text-xs text-gray-400">Please copy this credential. For security reasons, it will NOT be shown again in the web portal.</p>
                <div className="bg-gray-950 border border-gray-900 rounded-lg p-3 flex justify-between items-center font-mono text-xs text-white">
                  <span className="truncate pr-4 select-all">{newlyCreatedKey}</span>
                  <button 
                    onClick={() => copyToClipboard(newlyCreatedKey, 'key')}
                    className="btn-secondary py-1 px-2.5 text-[11px]"
                  >
                    {copiedKey ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}

            {/* Key creation form */}
            <div className="card space-y-4">
              <div className="text-left">
                <h3 className="font-bold text-white text-base">Generate New API Key</h3>
                <p className="text-xs text-gray-500">API keys authenticate your client SDK to access the proxy gateway.</p>
              </div>

              <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Key Label (e.g. Production Key)"
                  className="input flex-1"
                  value={keyLabel}
                  onChange={(e) => setKeyLabel(e.target.value)}
                  disabled={loading}
                  required
                />
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Key'}
                </button>
              </form>
            </div>

            {/* Active Keys List */}
            <div className="card space-y-4">
              <div className="text-left">
                <h3 className="font-bold text-white text-base">Active API Keys</h3>
                <p className="text-xs text-gray-500">Manage credentials authorized to use your account quota.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-3">Label</th>
                      <th className="py-3 px-3 font-mono">Prefix</th>
                      <th className="py-3 px-3 text-right">Requests (Month)</th>
                      <th className="py-3 px-3 text-right font-mono">Total Calls</th>
                      <th className="py-3 px-3 text-right">Last Used</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((key) => (
                      <tr key={key.id} className="border-b border-gray-900 hover:bg-gray-900/30 text-gray-300">
                        <td className="py-3 px-3 font-medium text-white">{key.label || 'Default Key'}</td>
                        <td className="py-3 px-3 font-mono text-gray-400">{key.key_prefix}xxxx</td>
                        <td className="py-3 px-3 text-right font-mono">{key.requests_this_month || 0}</td>
                        <td className="py-3 px-3 text-right font-mono">{key.total_requests || 0}</td>
                        <td className="py-3 px-3 text-right text-gray-500">
                          {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={14} /> Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                    {keys.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">No active API keys found. Generate a key above to start.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Plan limits note */}
              <div className="pt-4 border-t border-gray-800 text-left text-xs text-gray-500">
                ⚠️ **Limit Notice:** Active keys are constrained by plan levels: Free plans allow up to 3 keys, Pro allows 10 keys, and Team plans offer unlimited key allocation.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
