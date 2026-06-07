import { useState, useEffect } from 'react';
import { BandwidthBar } from '../components/BandwidthBar';
import { ScreenshotGrid } from '../components/ScreenshotGrid';
import { Play, Square, Settings } from 'lucide-react';

interface Account {
  email: string;
  bandwidthBytesRemaining: number;
}

interface Props {
  account: Account;
  onLogout: () => void;
}

type SessionState = 'idle' | 'starting' | 'active' | 'stopping';

export default function Main({ account, onLogout }: Props) {
  const [streamUrl, setStreamUrl] = useState('');
  const [instanceCount, setInstanceCount] = useState(4);
  const [country, setCountry] = useState('FR');
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Record<number, string>>({});
  const [bandwidth, setBandwidth] = useState(account.bandwidthBytesRemaining);

  useEffect(() => {
    const onScreenshot = (data: unknown) => {
      const { index, dataUrl } = data as { index: number; dataUrl: string };
      setScreenshots((prev) => ({ ...prev, [index]: dataUrl }));
    };
    const onHeartbeat = async (sid: unknown) => {
      if (typeof sid === 'string') await window.sbAPI.apiHeartbeat(sid);
    };

    window.sbAPI.on('screenshot:update', onScreenshot);
    window.sbAPI.on('session:heartbeat', onHeartbeat);

    return () => {
      window.sbAPI.off('screenshot:update', onScreenshot);
      window.sbAPI.off('session:heartbeat', onHeartbeat);
    };
  }, []);

  const startSession = async () => {
    if (!streamUrl) return;
    setSessionState('starting');
    let apiSessionId: string | null = null;
    try {
      const result = await window.sbAPI.apiSessionStart({
        platform: detectPlatformName(streamUrl),
        streamUrl,
        instanceCount,
        preferProxyCountry: country,
      });

      apiSessionId = result.sessionId;
      setSessionId(result.sessionId);
      setBandwidth(result.bandwidthRemainingBytes);

      await window.sbAPI.sessionStart({
        sessionId: result.sessionId,
        streamUrl,
        proxies: result.proxies,
      });

      setSessionState('active');
    } catch (e) {
      console.error(e);
      // Si l'API a créé la session mais que l'initialiseur Electron a échoué,
      // clore proprement la session côté API pour éviter une perte de bandwidth.
      if (apiSessionId) {
        window.sbAPI.apiSessionStop(apiSessionId).catch(() => {});
      }
      setSessionId(null);
      setSessionState('idle');
      alert(`Erreur: ${(e as Error).message}`);
    }
  };

  const stopSession = async () => {
    if (!sessionId) return;
    setSessionState('stopping');
    try {
      // Run both stops concurrently and independently — if the Electron browser
      // context fails, the API session must still be terminated to stop billing.
      await Promise.allSettled([
        window.sbAPI.sessionStop(sessionId),
        window.sbAPI.apiSessionStop(sessionId),
      ]);
    } finally {
      setSessionId(null);
      setScreenshots({});
      setSessionState('idle');

      window.sbAPI.getAccount()
        .then((acc) => setBandwidth((acc as Account).bandwidthBytesRemaining))
        .catch(() => {});
    }
  };

  const detectPlatformName = (url: string): string => {
    if (url.includes('twitch.tv')) return 'twitch';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('kick.com')) return 'kick';
    if (url.includes('tiktok.com')) return 'tiktok';
    return 'twitch';
  };

  const isRunning = sessionState === 'active';

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <h1 className="text-lg font-bold text-brand-500">StreamBooster</h1>
        <div className="flex-1 mx-8">
          <BandwidthBar remaining={bandwidth} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{account.email}</span>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex gap-4 p-6">
        <input
          type="text"
          placeholder="URL du stream (twitch.tv/..., youtube.com/...)"
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          disabled={isRunning}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-500 disabled:opacity-50"
        />

        <select
          value={instanceCount}
          onChange={(e) => setInstanceCount(+e.target.value)}
          disabled={isRunning}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>×{n}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Pays (FR, US...)"
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase())}
          disabled={isRunning}
          maxLength={2}
          className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm text-center"
        />

        {!isRunning ? (
          <button
            onClick={startSession}
            disabled={!streamUrl || sessionState === 'starting'}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Play size={16} />
            {sessionState === 'starting' ? 'Démarrage...' : 'Lancer'}
          </button>
        ) : (
          <button
            onClick={stopSession}
            disabled={sessionState === 'stopping'}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Square size={16} />
            {sessionState === 'stopping' ? 'Arrêt...' : 'Arrêter'}
          </button>
        )}
      </div>

      <main className="flex-1 overflow-auto px-6 pb-6">
        {isRunning ? (
          <ScreenshotGrid screenshots={screenshots} instanceCount={instanceCount} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600">
            <div className="text-center">
              <Settings size={48} className="mx-auto mb-4 opacity-30" />
              <p>Saisissez une URL et cliquez sur Lancer pour démarrer une session</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
