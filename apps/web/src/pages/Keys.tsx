import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Trash2, Copy, Check } from 'lucide-react';

export default function Keys() {
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data: keys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/keys').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (label: string) => api.post('/keys', { label }).then((r) => r.data),
    onSuccess: (data) => {
      setNewKey(data.key);
      setLabel('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: () => {
      alert('Erreur lors de la création de la clé. Veuillez réessayer.');
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: () => {
      alert('Erreur lors de la révocation de la clé. Veuillez réessayer.');
    },
  });

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Clés API</h1>

      {newKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
          <p className="text-green-400 font-medium mb-2">Clé créée — copiez-la maintenant, elle ne sera plus affichée !</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm bg-gray-900 px-4 py-2 rounded-lg text-green-300 break-all">
              {newKey}
            </code>
            <button onClick={copyKey} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
              {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-400"
          >
            J'ai copié ma clé ×
          </button>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Créer une nouvelle clé</h2>
        {newKey ? (
          <p className="text-sm text-gray-500">Copiez la clé affichée ci-dessus avant d'en créer une nouvelle.</p>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nom du device (ex: Mon PC bureau)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => create.mutate(label || 'Mon device')}
              disabled={create.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              Créer
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Mes clés ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune clé API. Créez-en une ci-dessus.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key: { id: string; label: string; lastUsedAt: string | null; createdAt: string }) => (
              <div key={key.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{key.label}</p>
                  <p className="text-xs text-gray-500">
                    Créée le {new Date(key.createdAt).toLocaleDateString('fr-FR')}
                    {key.lastUsedAt && ` · Utilisée le ${new Date(key.lastUsedAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <button
                  onClick={() => revoke.mutate(key.id)}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
