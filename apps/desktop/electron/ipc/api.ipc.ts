import { ipcMain } from 'electron';
import Store from 'electron-store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Store() as any;
const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.streambooster.io/api/v1'
  : 'http://localhost:3001/api/v1';

function getApiBase(): string {
  return (store.get('apiBase') as string | undefined) ?? API_BASE;
}

function getApiKey(): string | null {
  return (store.get('apiKey') as string | undefined) ?? null;
}

export function registerApiIpc() {
  ipcMain.handle('api:validate-key', async (_e, apiKey: string) => {
    const res = await fetch(`${getApiBase()}/account/me`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!res.ok) throw new Error('Invalid API key');
    const data = await res.json();
    store.set('apiKey', apiKey);
    return data;
  });

  ipcMain.handle('api:get-account', async () => {
    const key = getApiKey();
    if (!key) throw new Error('Not authenticated');
    const res = await fetch(`${getApiBase()}/account/me`, {
      headers: { 'x-api-key': key },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });

  ipcMain.handle('api:session-start', async (_e, body: object) => {
    const key = getApiKey();
    if (!key) throw new Error('Not authenticated');
    const res = await fetch(`${getApiBase()}/sessions/start`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });

  ipcMain.handle('api:session-heartbeat', async (_e, sessionId: string, bytes: number) => {
    const key = getApiKey();
    if (!key) return;
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytesConsumed: bytes }),
    });
    if (res.status === 404) return { sessionExpired: true };
    if (!res.ok) return;
    return res.json();
  });

  ipcMain.handle('api:session-stop', async (_e, sessionId: string, finalBytes: number) => {
    const key = getApiKey();
    if (!key) return;
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalBytes }),
    });
    if (!res.ok) throw new Error(await res.text());
  });

  ipcMain.handle('api:logout', () => {
    store.delete('apiKey');
  });
}
