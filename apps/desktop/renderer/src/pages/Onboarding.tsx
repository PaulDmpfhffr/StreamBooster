import { useState } from 'react';
import { Zap } from 'lucide-react';

declare global {
  interface Window {
    sbAPI: {
      validateKey: (key: string) => Promise<{ email: string; bandwidthBytesRemaining: number }>;
      getAccount: () => Promise<unknown>;
      logout: () => Promise<void>;
      sessionStart: (config: object) => Promise<void>;
      sessionStop: (sessionId: string) => Promise<void>;
      apiSessionStart: (body: object) => Promise<{
        sessionId: string;
        proxies: Array<{ index: number; address: string }>;
        bandwidthRemainingBytes: number;
      }>;
      apiSessionStop: (sessionId: string) => Promise<void>;
      apiHeartbeat: (sessionId: string) => Promise<{ sessionExpired?: boolean } | undefined>;
      on: (channel: string, cb: (...args: unknown[]) => void) => void;
      off: (channel: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

interface Props {
  onSuccess: (account: { email: string; bandwidthBytesRemaining: number }) => void;
}

export default function Onboarding({ onSuccess }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const account = await window.sbAPI.validateKey(apiKey.trim());
      onSuccess(account);
    } catch {
      setError('Clé API invalide. Vérifiez votre clé sur streambooster.io');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={32} className="text-brand-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">StreamBooster</h1>
          <p className="text-gray-400 mt-2">Entrez votre clé API pour commencer</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-xl border border-gray-800 p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Clé API StreamBooster</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sb_..."
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Obtenez votre clé sur streambooster.io → Clés API
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Validation...' : 'Connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
