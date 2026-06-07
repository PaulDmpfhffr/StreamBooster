import { ipcMain, BrowserWindow, app } from 'electron';
import { SessionManager } from '../core/sessionManager';

const manager = new SessionManager();

app.on('before-quit', () => { manager.stopAll().catch(() => {}); });

export function registerSessionIpc(getWin: () => BrowserWindow | null) {
  ipcMain.handle('session:start', async (_e, config: {
    sessionId: string;
    streamUrl: string;
    proxies: Array<{ index: number; address: string }>;
  }) => {
    await manager.start(
      {
        ...config,
        onScreenshot: (index, png) => {
          getWin()?.webContents.send('screenshot:update', {
            index,
            dataUrl: `data:image/png;base64,${png.toString('base64')}`,
          });
        },
        onViewerCount: (count) => {
          getWin()?.webContents.send('viewer:update', { count });
        },
      },
      async () => {
        // Collecte les bytes réels depuis le dernier heartbeat et les envoie au renderer.
        const bytes = manager.getAndResetBytes(config.sessionId);
        getWin()?.webContents.send('session:heartbeat', { sessionId: config.sessionId, bytes });
      },
    );
    getWin()?.webContents.send('session:started', config.sessionId);
  });

  ipcMain.handle('session:stop', async (_e, sessionId: string) => {
    // Retourne les bytes non encore reportés pour la déduction finale côté API.
    const finalBytes = await manager.stop(sessionId);
    getWin()?.webContents.send('session:stopped', sessionId);
    return { finalBytes };
  });
}
