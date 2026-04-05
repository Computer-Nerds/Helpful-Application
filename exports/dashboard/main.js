const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#0f0f0f',
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);

ipcMain.on('win-close',    () => win && win.close());
ipcMain.on('win-minimize', () => win && win.minimize());
ipcMain.on('win-maximize', () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
