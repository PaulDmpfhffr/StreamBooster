import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatBytes } from '../lib/utils';
import { Edit2, Check, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: string;
  bandwidthBytesRemaining: number;
  bandwidthBytesUsedTotal: number;
  createdAt: string;
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  });

  const adjust = useMutation({
    mutationFn: ({ userId, bytesDelta, reason }: { userId: string; bytesDelta: number; reason: string }) =>
      api.patch(`/admin/users/${userId}/bandwidth`, { bytesDelta, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setAdjusting(null);
      setDelta('');
      setReason('');
    },
  });

  const handleAdjust = (userId: string) => {
    const go = parseFloat(delta);
    if (isNaN(go) || !reason) return;
    adjust.mutate({ userId, bytesDelta: Math.round(go * 1024 * 1024 * 1024), reason });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Utilisateurs</h1>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr className="text-gray-400">
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-left px-4 py-3">BP restante</th>
              <th className="text-left px-4 py-3">Total consommé</th>
              <th className="text-left px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <>
                <tr key={u.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-white">{formatBytes(Number(u.bandwidthBytesRemaining))}</td>
                  <td className="px-4 py-3 text-gray-400">{formatBytes(Number(u.bandwidthBytesUsedTotal))}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setAdjusting(adjusting === u.id ? null : u.id)}
                      className="p-1.5 rounded text-gray-500 hover:text-brand-400 hover:bg-gray-700 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
                {adjusting === u.id && (
                  <tr key={`${u.id}-adjust`} className="border-t border-brand-500/30 bg-brand-500/5">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Go (ex: 10 ou -5)"
                          value={delta}
                          onChange={(e) => setDelta(e.target.value)}
                          className="w-40 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Raison"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <button
                          onClick={() => handleAdjust(u.id)}
                          disabled={adjust.isPending}
                          className="p-1.5 rounded bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setAdjusting(null)}
                          className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
