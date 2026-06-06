import { ipcMain, BrowserWindow } from 'electron';
import { SessionManager } from '../core/sessionManager';

const manager = new SessionManager();

export function registerSessionIpc(win: BrowserWindow) {
  ipcMain.handle('session:start', async (_e, config: {
    sessionId: string;
    streamUrl: string;
    proxies: Array<{ index: number; address: string }>;
  }) => {
    await manager.start(
      {
        ...config,
        onScreenshot: (index, png) => {
          win.webContents.send('screenshot:update', {
            index,
            dataUrl: `data:image/png;base64,${png.toString('base64')}`,
          });
        },
      },
      async () => {
        win.webContents.send('session:heartbeat', config.sessionId);
      },
    );
    win.webContents.send('session:started', config.sessionId);
  });

  ipcMain.handle('session:stop', async (_e, sessionId: string) => {
    await manager.stop(sessionId);
    win.webContents.send('session:stopped', sessionId);
  });
}
