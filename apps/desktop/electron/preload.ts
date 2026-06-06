import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type Callback = (...args: unknown[]) => void;
const listenerMap = new Map<Callback, (e: IpcRendererEvent, ...args: unknown[]) => void>();

contextBridge.exposeInMainWorld('sbAPI', {
  validateKey: (key: string) => ipcRenderer.invoke('api:validate-key', key),
  getAccount: () => ipcRenderer.invoke('api:get-account'),
  logout: () => ipcRenderer.invoke('api:logout'),

  sessionStart: (config: object) => ipcRenderer.invoke('session:start', config),
  sessionStop: (sessionId: string) => ipcRenderer.invoke('session:stop', sessionId),
  apiSessionStart: (body: object) => ipcRenderer.invoke('api:session-start', body),
  apiSessionStop: (sessionId: string) => ipcRenderer.invoke('api:session-stop', sessionId),
  apiHeartbeat: (sessionId: string) => ipcRenderer.invoke('api:session-heartbeat', sessionId),

  on: (channel: string, cb: Callback) => {
    const wrapped = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...args);
    listenerMap.set(cb, wrapped);
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel: string, cb: Callback) => {
    const wrapped = listenerMap.get(cb);
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped);
      listenerMap.delete(cb);
    }
  },
});
