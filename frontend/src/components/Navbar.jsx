import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, LogOut, Settings, Activity } from 'lucide-react';

export default function Navbar({ session }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
            V
          </div>
          <span className="font-bold text-xl tracking-tight">VibeCore</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <Link to="/health" className="hover:text-white transition-colors">Network Health</Link>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
                <LayoutDashboard className="w-5 h-5" />
              </Link>
              <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-400 hover:text-white">Sign In</Link>
              <Link to="/register" className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
