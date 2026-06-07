import { ipcMain, BrowserWindow, app } from 'electron';
import { SessionManager } from '../core/sessionManager';

const manager = new SessionManager();

// Stop all active browser sessions before the app quits to avoid orphan processes.
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
      },
      async () => {
        getWin()?.webContents.send('session:heartbeat', config.sessionId);
      },
    );
    getWin()?.webContents.send('session:started', config.sessionId);
  });

  ipcMain.handle('session:stop', async (_e, sessionId: string) => {
    await manager.stop(sessionId);
    getWin()?.webContents.send('session:stopped', sessionId);
  });
}
