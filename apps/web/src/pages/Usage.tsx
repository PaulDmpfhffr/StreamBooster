import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatBytes } from '../lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Session {
  id: string;
  platform: string;
  streamUrl: string;
  instanceCount: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  bytesEstimated: number;
}

export default function Usage() {
  const { data } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.get('/account/usage').then((r) => r.data),
  });

  const sessions: Session[] = data?.sessions ?? [];

  const chartData = sessions
    .filter((s) => s.status === 'ended')
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      date: new Date(s.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      bytes: Number(s.bytesEstimated) / (1024 * 1024 * 1024),
    }));

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400',
      ended: 'bg-gray-700 text-gray-400',
      error: 'bg-red-500/20 text-red-400',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? 'bg-gray-700 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Utilisation</h1>

      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Consommation (Go) par session</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" Go" />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(2)} Go`, 'Consommation']}
              />
              <Area type="monotone" dataKey="bytes" stroke="#0ea5e9" fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Historique des sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left pb-3">Plateforme</th>
                <th className="text-left pb-3">Instances</th>
                <th className="text-left pb-3">Consommé</th>
                <th className="text-left pb-3">Statut</th>
                <th className="text-left pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="py-3 text-white capitalize">{s.platform}</td>
                  <td className="py-3 text-gray-300">×{s.instanceCount}</td>
                  <td className="py-3 text-gray-300">{formatBytes(Number(s.bytesEstimated))}</td>
                  <td className="py-3">{statusBadge(s.status)}</td>
                  <td className="py-3 text-gray-400">
                    {new Date(s.startedAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
