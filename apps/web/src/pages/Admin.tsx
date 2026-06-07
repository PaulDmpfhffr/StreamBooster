import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatBytes } from '../lib/utils';
import { Users, Activity, HardDrive } from 'lucide-react';

export default function Admin() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Administration</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Users size={20} className="text-blue-400" />}
          label="Utilisateurs"
          value={stats?.userCount ?? '—'}
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<Activity size={20} className="text-green-400" />}
          label="Sessions actives"
          value={stats?.activeSessions ?? '—'}
          bg="bg-green-500/10"
        />
        <StatCard
          icon={<HardDrive size={20} className="text-purple-400" />}
          label="BP totale vendue"
          value={stats ? formatBytes(stats.totalBandwidthSoldBytes) : '—'}
          bg="bg-purple-500/10"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Utilisateurs', to: '/admin/users' },
          { label: 'Proxys & Fournisseurs', to: '/admin/proxies' },
          { label: 'Sessions live', to: '/admin/sessions' },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-brand-500 transition-colors text-white font-medium"
          >
            {link.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
