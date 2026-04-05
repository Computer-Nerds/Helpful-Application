const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

let win;

// ── Music folder paths ──────────────────────────────────────────────────────
const MUSIC_DIR  = path.join(app.getPath('userData'), 'music');
const COVERS_DIR = path.join(MUSIC_DIR, 'covers');
const LIB_FILE   = path.join(MUSIC_DIR, 'library.json');

function ensureDirs() {
  if (!fs.existsSync(MUSIC_DIR))  fs.mkdirSync(MUSIC_DIR,  { recursive: true });
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
}

function readLibrary() {
  try { return JSON.parse(fs.readFileSync(LIB_FILE, 'utf8')); }
  catch { return []; }
}

function writeLibrary(tracks) {
  fs.writeFileSync(LIB_FILE, JSON.stringify(tracks, null, 2), 'utf8');
}

// Parse "Artist - Title" filename convention
function parseFilename(filename) {
  const base  = filename.replace(/\.[^.]+$/, '');
  const parts = base.split(' - ');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: '', title: base.replace(/[-_]/g, ' ').trim() };
}

// Scan music folder and merge with library (preserves manual edits)
function syncLibrary() {
  ensureDirs();
  const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
  const lib = readLibrary();
  const libMap = Object.fromEntries(lib.map(t => [t.filename, t]));

  // Add new files not in library
  const files = fs.readdirSync(MUSIC_DIR).filter(f => AUDIO_EXT.test(f));
  let changed = false;
  files.forEach(f => {
    if (!libMap[f]) {
      const parsed = parseFilename(f);
      libMap[f] = {
        id:       Date.now() + Math.random(),
        filename: f,
        title:    parsed.title,
        artist:   parsed.artist,
        cover:    '',   // cover filename in covers/ folder, or ''
      };
      changed = true;
    }
  });

  // Remove entries whose files no longer exist
  for (const key of Object.keys(libMap)) {
    if (!files.includes(key)) { delete libMap[key]; changed = true; }
  }

  const result = Object.values(libMap);
  if (changed) writeLibrary(result);
  return result;
}

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  ensureDirs();

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

  // Watch music folder for new/removed files
  let watchDebounce;
  fs.watch(MUSIC_DIR, (eventType, filename) => {
    if (!filename) return;
    clearTimeout(watchDebounce);
    watchDebounce = setTimeout(() => {
      const tracks = syncLibrary();
      if (win && !win.isDestroyed()) win.webContents.send('music-library-updated', tracks);
    }, 400);
  });
}

app.whenReady().then(createWindow);

// ── IPC: titlebar ────────────────────────────────────────────────────────────
ipcMain.on('win-close',    () => win && win.close());
ipcMain.on('win-minimize', () => win && win.minimize());
ipcMain.on('win-maximize', () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()));

// ── IPC: music ───────────────────────────────────────────────────────────────

// Renderer asks for initial library
ipcMain.handle('music-get-library', () => syncLibrary());

// Renderer asks for the music folder path (to show user)
ipcMain.handle('music-get-folder',  () => MUSIC_DIR);

// Save library metadata (title/artist/cover edits)
ipcMain.on('music-save-library', (_e, tracks) => writeLibrary(tracks));

// Save a dropped audio file into the music folder
ipcMain.handle('music-save-file', (_e, filename, buffer) => {
  ensureDirs();
  const dest = path.join(MUSIC_DIR, filename);
  fs.writeFileSync(dest, Buffer.from(buffer));
  return syncLibrary();
});

// Save cover art into covers/ folder
ipcMain.handle('music-save-cover', (_e, trackFilename, imgBuffer, ext) => {
  ensureDirs();
  const coverFilename = trackFilename.replace(/\.[^.]+$/, '') + '.' + ext;
  fs.writeFileSync(path.join(COVERS_DIR, coverFilename), Buffer.from(imgBuffer));
  const lib = readLibrary();
  const t   = lib.find(x => x.filename === trackFilename);
  if (t) { t.cover = coverFilename; writeLibrary(lib); }
  return coverFilename;
});

// Delete a track (remove from library only, leave file)
ipcMain.handle('music-delete-track', (_e, filename) => {
  const lib = readLibrary().filter(t => t.filename !== filename);
  writeLibrary(lib);
  return lib;
});

// Open folder in Explorer/Finder
ipcMain.on('music-open-folder', () => {
  require('electron').shell.openPath(MUSIC_DIR);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
