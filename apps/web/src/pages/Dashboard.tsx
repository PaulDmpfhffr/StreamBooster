import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatBytes } from '../lib/utils';
import { Zap, Activity, TrendingUp, Clock } from 'lucide-react';

export default function Dashboard() {
  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: () => api.get('/account/me').then((r) => r.data),
  });

  const { data: usage } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.get('/account/usage').then((r) => r.data),
  });

  const activeSessions = usage?.sessions?.filter((s: { status: string }) => s.status === 'active') ?? [];
  const recentTransactions = usage?.transactions?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Zap size={20} className="text-yellow-400" />}
          label="Bande passante restante"
          value={account ? formatBytes(account.bandwidthBytesRemaining) : '—'}
          bg="bg-yellow-500/10"
        />
        <StatCard
          icon={<Activity size={20} className="text-green-400" />}
          label="Sessions actives"
          value={String(activeSessions.length)}
          bg="bg-green-500/10"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-blue-400" />}
          label="Total consommé"
          value={account ? formatBytes(account.bandwidthBytesUsedTotal) : '—'}
          bg="bg-blue-500/10"
        />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Dernières transactions</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune transaction</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((tx: {
              id: string;
              description: string;
              bytesDelta: number;
              createdAt: string;
              type: string;
            }) => (
              <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-300">{tx.description}</span>
                </div>
                <span className={`text-sm font-mono ${tx.bytesDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.bytesDelta > 0 ? '+' : ''}{formatBytes(Math.abs(tx.bytesDelta))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: {
  icon: React.ReactNode;
  label: string;
  value: string;
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
