import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Trash2, Wifi, WifiOff } from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  displayName: string;
  adapterType: string;
  isActive: boolean;
  priority: number;
  apiEndpoint: string;
}

interface Proxy {
  id: string;
  countryCode: string;
  type: string;
  isActive: boolean;
  provider: { displayName: string };
}

export default function AdminProxies() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'proxies' | 'providers'>('providers');
  const [showAddProxy, setShowAddProxy] = useState(false);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [healthStatus, setHealthStatus] = useState<Record<string, boolean | null>>({});

  const { data: proxies = [] } = useQuery<Proxy[]>({
    queryKey: ['admin-proxies'],
    queryFn: () => api.get('/admin/proxies').then((r) => r.data),
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['admin-providers'],
    queryFn: () => api.get('/admin/providers').then((r) => r.data),
  });

  const deleteProxy = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/proxies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-proxies'] }),
    onError: () => { alert('Impossible de supprimer ce proxy (peut-être utilisé par une session active).'); },
  });

  const [newProxy, setNewProxy] = useState({ providerId: '', address: '', countryCode: 'FR', type: 'residential' });
  const [newProvider, setNewProvider] = useState({
    name: '', displayName: '', adapterType: 'manual', apiKey: '', apiEndpoint: '', priority: 0,
  });

  const addProxy = useMutation({
    mutationFn: () => api.post('/admin/proxies', newProxy),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-proxies'] }); setShowAddProxy(false); },
    onError: () => { setShowAddProxy(true); },
  });

  const addProvider = useMutation({
    mutationFn: () => api.post('/admin/providers', newProvider),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers'] }); setShowAddProvider(false); },
    onError: () => { setShowAddProvider(true); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Proxys & Fournisseurs</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('providers')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'providers' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Fournisseurs ({providers.length})
          </button>
          <button
            onClick={() => setTab('proxies')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'proxies' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Pool ({proxies.length})
          </button>
        </div>
      </div>

      {tab === 'providers' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr className="text-gray-400">
                  <th className="text-left px-4 py-3">Fournisseur</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Priorité</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Connectivité</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-white font-medium">{p.displayName}</td>
                    <td className="px-4 py-3 text-gray-400">{p.adapterType}</td>
                    <td className="px-4 py-3 text-gray-400">{p.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'
                      }`}>
                        {p.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {healthStatus[p.id] === true && <Wifi size={16} className="text-green-400" />}
                      {healthStatus[p.id] === false && <WifiOff size={16} className="text-red-400" />}
                      {healthStatus[p.id] === null && (
                        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      {healthStatus[p.id] === undefined && (
                        <button
                          onClick={async () => {
                            setHealthStatus((prev) => ({ ...prev, [p.id]: null }));
                            try {
                              const res = await api.get<{ healthy: boolean }>(`/admin/providers/${p.id}/health`);
                              setHealthStatus((prev) => ({ ...prev, [p.id]: res.data.healthy }));
                            } catch {
                              setHealthStatus((prev) => ({ ...prev, [p.id]: false }));
                            }
                          }}
                          className="text-xs text-gray-500 hover:text-brand-400"
                        >
                          Tester
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setShowAddProvider(!showAddProvider)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus size={16} /> Ajouter un fournisseur
          </button>

          {showAddProvider && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-2 gap-3">
              {['name', 'displayName', 'apiKey', 'apiEndpoint'].map((field) => (
                <input
                  key={field}
                  placeholder={field}
                  value={(newProvider as Record<string, string | number>)[field] as string}
                  onChange={(e) => setNewProvider((p) => ({ ...p, [field]: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              ))}
              <select
                value={newProvider.adapterType}
                onChange={(e) => setNewProvider((p) => ({ ...p, adapterType: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                {['manual', 'iproyal', 'brightdata', 'webshare'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="priorité"
                value={newProvider.priority}
                onChange={(e) => setNewProvider((p) => ({ ...p, priority: +e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => addProvider.mutate()}
                className="col-span-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm"
              >
                Créer
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'proxies' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr className="text-gray-400">
                  <th className="text-left px-4 py-3">Fournisseur</th>
                  <th className="text-left px-4 py-3">Pays</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {proxies.map((p) => (
                  <tr key={p.id} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-gray-300">{p.provider.displayName}</td>
                    <td className="px-4 py-3 text-white font-mono">{p.countryCode}</td>
                    <td className="px-4 py-3 text-gray-400">{p.type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'
                      }`}>
                        {p.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteProxy.mutate(p.id)}
                        className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setShowAddProxy(!showAddProxy)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus size={16} /> Ajouter un proxy
          </button>

          {showAddProxy && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-2 gap-3">
              <select
                value={newProxy.providerId}
                onChange={(e) => setNewProxy((p) => ({ ...p, providerId: e.target.value }))}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                <option value="">Sélectionner un fournisseur</option>
                {providers.map((pr) => <option key={pr.id} value={pr.id}>{pr.displayName}</option>)}
              </select>
              <input
                placeholder="socks5://user:pass@ip:port"
                value={newProxy.address}
                onChange={(e) => setNewProxy((p) => ({ ...p, address: e.target.value }))}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono"
              />
              <input
                placeholder="Code pays (FR, US...)"
                value={newProxy.countryCode}
                maxLength={2}
                onChange={(e) => setNewProxy((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
              <select
                value={newProxy.type}
                onChange={(e) => setNewProxy((p) => ({ ...p, type: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                {['residential', 'mobile', 'datacenter'].map((t) => <option key={t}>{t}</option>)}
              </select>
              <button
                onClick={() => addProxy.mutate()}
                className="col-span-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm"
              >
                Ajouter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
