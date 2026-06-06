import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { formatBytes } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { Activity } from 'lucide-react';

interface LiveSession {
  id: string;
  platform: string;
  streamUrl: string;
  instanceCount: number;
  status: string;
  startedAt: string;
  bytesEstimated: number;
  user: { email: string };
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [connected, setConnected] = useState(false);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const socket: Socket = io('/admin/sessions', {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('sessions:list', (data: LiveSession[]) => setSessions(data));
    socket.on('session:update', (update: { id: string; status: string }) => {
      setSessions((prev) =>
        update.status === 'ended'
          ? prev.filter((s) => s.id !== update.id)
          : prev.map((s) => (s.id === update.id ? { ...s, ...update } : s)),
      );
    });

    const interval = setInterval(() => socket.emit('sessions:refresh'), 10_000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [accessToken]);

  const elapsed = (startedAt: string) => {
    const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    return mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h${mins % 60}min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Sessions actives</h1>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
          connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? 'Live' : 'Déconnecté'}
        </div>
        <span className="text-gray-500 text-sm">{sessions.length} session(s)</span>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-16 flex flex-col items-center text-gray-600">
          <Activity size={48} className="mb-4 opacity-30" />
          <p>Aucune session active en ce moment</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr className="text-gray-400">
                <th className="text-left px-4 py-3">Utilisateur</th>
                <th className="text-left px-4 py-3">Plateforme</th>
                <th className="text-left px-4 py-3">Instances</th>
                <th className="text-left px-4 py-3">Durée</th>
                <th className="text-left px-4 py-3">BP estimée</th>
                <th className="text-left px-4 py-3">URL</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-gray-800">
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{s.user.email}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-white font-medium">{s.platform}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">×{s.instanceCount}</td>
                  <td className="px-4 py-3 text-gray-400">{elapsed(s.startedAt)}</td>
                  <td className="px-4 py-3 text-yellow-400">{formatBytes(Number(s.bytesEstimated))}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate text-xs">{s.streamUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
