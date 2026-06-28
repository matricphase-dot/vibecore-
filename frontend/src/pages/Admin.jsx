import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { 
  ArrowLeft, Users, ShieldAlert, BarChart3, 
  Terminal, ShieldCheck, Coins, Layers, Trash2, Activity
} from 'lucide-react';

export default function Admin({ session }) {
  const [stats, setStats] = useState({
    total_users: 0,
    total_requests: 0,
    total_tokens_saved: 0,
    total_usd_saved: 0.00,
    cache_hit_rate_pct: 0
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Admin summary stats
      const statsData = await apiFetch('/api/admin/stats');
      setStats(statsData);

      // 2. Fetch User profiles
      const usersData = await apiFetch('/api/admin/users');
      setUsers(usersData || []);
    } catch (err) {
      setError(err.message || 'Failed to authorize admin credentials or query system logs.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (userId, newPlan) => {
    setUpdatingId(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan: newPlan })
      });
      // Refresh local copy
      setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
    } catch (err) {
      alert(err.message || 'Failed to update user plan tier');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user permanently? This cannot be undone.')) return;

    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      setUsers(users.filter(u => u.id !== userId));
      alert('User deleted successfully.');
    } catch (err) {
      alert(err.message || 'Failed to delete user account registry');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12 relative overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute w-[500px] h-[500px] bg-green-500/5 rounded-full filter blur-3xl -z-10 top-0 left-0" />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Action Row */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          
          <button 
            onClick={() => navigate('/health')}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Activity size={14} /> View System Health
          </button>
        </div>

        {/* Brand & Admin Title */}
        <div className="text-left space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-green-400" /> Admin Quota Console
          </h1>
          <p className="text-gray-400 text-sm">Platform-wide statistics and manual profile plan tier configuration controls.</p>
        </div>

        {loading ? (
          <div className="card py-12 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-400"></div>
            <p className="text-xs text-gray-500 font-mono">Loading platform telemetry...</p>
          </div>
        ) : error ? (
          <div className="card border-red-500/30 bg-red-500/5 text-left p-6 space-y-2">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <ShieldAlert size={18} /> Admin Access Rejected
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{error}</p>
            <p className="text-xs text-gray-500 font-mono">Ensure your session account contains the `is_admin = true` column tag in the database profiles registry.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Platform metrics grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                  <Users size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Total Users</div>
                  <div className="text-2xl font-bold text-white">{stats.total_users}</div>
                </div>
              </div>

              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <Terminal size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Global Requests</div>
                  <div className="text-2xl font-bold text-white">{stats.total_requests}</div>
                </div>
              </div>

              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Layers size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Global Cache Hits</div>
                  <div className="text-2xl font-bold text-white">{stats.cache_hit_rate_pct}%</div>
                </div>
              </div>

              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Coins size={20} />
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500">Global Savings</div>
                  <div className="text-2xl font-bold text-white">${stats.total_usd_saved.toFixed(4)}</div>
                </div>
              </div>
            </div>

            {/* Users Administration Table */}
            <div className="card space-y-4">
              <div className="text-left">
                <h3 className="font-bold text-white text-base">Register of Users</h3>
                <p className="text-xs text-gray-500">Override billing plan configurations and clean account registrations.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-3">Email Address</th>
                      <th className="py-3 px-3">Active Quota Level (Plan)</th>
                      <th className="py-3 px-3 text-right">Requests Logged</th>
                      <th className="py-3 px-3 text-right">Join Date</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-900 hover:bg-gray-900/30 text-gray-300">
                        <td className="py-3 px-3 font-medium text-white">{u.email}</td>
                        <td className="py-3 px-3">
                          <select
                            value={u.plan}
                            onChange={(e) => handlePlanChange(u.id, e.target.value)}
                            disabled={updatingId === u.id}
                            className="bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-green-500 transition-all font-medium cursor-pointer"
                          >
                            <option value="free">Free Plan</option>
                            <option value="pro">Pro Plan</option>
                            <option value="team">Team Plan</option>
                            <option value="enterprise">Enterprise Plan</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-gray-400">{u.total_requests || 0}</td>
                        <td className="py-3 px-3 text-right text-gray-500 font-mono">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={u.id === session.user.id}
                            className={`p-1.5 rounded-lg hover:bg-red-500/10 transition-colors inline-flex items-center gap-1 cursor-pointer ${
                              u.id === session.user.id 
                                ? 'text-gray-600 cursor-not-allowed opacity-50' 
                                : 'text-red-400 hover:text-red-300'
                            }`}
                          >
                            <Trash2 size={14} /> Delete Account
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500">No users found registered in system profiles database.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
