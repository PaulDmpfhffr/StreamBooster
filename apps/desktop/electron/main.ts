import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { registerApiIpc } from './ipc/api.ipc';
import { registerSessionIpc } from './ipc/session.ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#030712',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // Enregistrer les IPC une seule fois, avant la création de fenêtre
  registerApiIpc();
  registerSessionIpc(() => mainWindow);

  createWindow();

  if (process.env.NODE_ENV !== 'development') {
    setupAutoUpdater();
  }
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `StreamBooster ${info.version} est disponible. Voulez-vous télécharger et installer ?`,
      buttons: ['Télécharger', 'Plus tard'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour prête',
      message: 'La mise à jour a été téléchargée. Redémarrez pour l\'appliquer.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdates();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
