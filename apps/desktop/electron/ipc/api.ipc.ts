import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store();
const API_BASE = 'https://api.streambooster.io/api/v1';

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

  ipcMain.handle('api:session-heartbeat', async (_e, sessionId: string) => {
    const key = getApiKey();
    if (!key) return;
    await fetch(`${getApiBase()}/sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      headers: { 'x-api-key': key },
    });
  });

  ipcMain.handle('api:session-stop', async (_e, sessionId: string) => {
    const key = getApiKey();
    if (!key) return;
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: { 'x-api-key': key },
    });
    if (!res.ok) throw new Error(await res.text());
  });

  ipcMain.handle('api:logout', () => {
    store.delete('apiKey');
  });
}
