import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sbAPI', {
  validateKey: (key: string) => ipcRenderer.invoke('api:validate-key', key),
  getAccount: () => ipcRenderer.invoke('api:get-account'),
  logout: () => ipcRenderer.invoke('api:logout'),

  sessionStart: (config: object) => ipcRenderer.invoke('session:start', config),
  sessionStop: (sessionId: string) => ipcRenderer.invoke('session:stop', sessionId),
  apiSessionStart: (body: object) => ipcRenderer.invoke('api:session-start', body),
  apiSessionStop: (sessionId: string) => ipcRenderer.invoke('api:session-stop', sessionId),
  apiHeartbeat: (sessionId: string) => ipcRenderer.invoke('api:session-heartbeat', sessionId),

  on: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
  off: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, cb);
  },
});
