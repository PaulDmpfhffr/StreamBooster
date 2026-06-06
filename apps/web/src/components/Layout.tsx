import { Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  LayoutDashboard, Key, CreditCard, BarChart3,
  Settings, LogOut, Shield,
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/keys', label: 'Clés API', icon: Key },
  { to: '/billing', label: 'Facturation', icon: CreditCard },
  { to: '/usage', label: 'Utilisation', icon: BarChart3 },
];

export function AuthLayout() {
  const { accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-brand-500">StreamBooster</h1>
        <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === to
                ? 'bg-brand-500/20 text-brand-500'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}

        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mt-4',
              pathname.startsWith('/admin')
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
            )}
          >
            <Shield size={18} />
            Admin
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 w-full transition-colors"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
