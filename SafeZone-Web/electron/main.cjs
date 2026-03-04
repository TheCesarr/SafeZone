const { app, BrowserWindow, desktopCapturer, session, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// ── Build Config ──────────────────────────────────────────────────────────────
let buildConfig = { type: 'client', adminSecret: '' };
try {
    buildConfig = require('./build_config.cjs');
    console.log(`[Electron] Build Type: ${buildConfig.type}`);
} catch (e) {
    console.error("[Electron] Could not load build_config.cjs, defaulting to client.", e);
}

// ── Server Config (dynamic — edit server-config.json, no rebuild needed) ─────
const SERVER_CONFIG_PATHS = [
    // Packaged app: next to the .exe / app resources
    path.join(process.resourcesPath || '', 'server-config.json'),
    // Development: same folder as main.cjs
    path.join(__dirname, 'server-config.json'),
];

let serverHost = '31.57.156.201';  // fallback if file is missing
let serverPort = 8000;
let useHttps = false;

for (const configPath of SERVER_CONFIG_PATHS) {
    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const cfg = JSON.parse(raw);
            if (cfg.serverHost) serverHost = cfg.serverHost;
            if (cfg.serverPort) serverPort = cfg.serverPort;
            if (cfg.useHttps !== undefined) useHttps = cfg.useHttps;
            console.log(`[Electron] Server config loaded from: ${configPath}`);
            break;
        }
    } catch (e) {
        console.warn(`[Electron] Could not read ${configPath}:`, e.message);
    }
}

const SERVER_BASE = `${serverHost}:${serverPort}`;
const SERVER_HTTP = `${useHttps ? 'https' : 'http'}://${SERVER_BASE}`;
console.log(`[Electron] Using server: ${SERVER_HTTP} (useHttps=${useHttps})`);

// ── Chromium Flags ────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
// Only needed for HTTP — HTTPS origins are already secure
if (!useHttps) {
    app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', SERVER_HTTP);
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.disableHardwareAcceleration();

// Forcefully accept all certificates (Critical for WSS connection)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

// ── AutoUpdater Handlers ──────────────────────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('update-available', info));
});
autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('update-downloaded', info));
});
autoUpdater.on('download-progress', (progressObj) => {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('update-progress', progressObj));
});
autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});
ipcMain.handle('check-for-updates', () => {
    if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
});

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-build-type', () => buildConfig.type);
ipcMain.handle('get-admin-secret', () => buildConfig.adminSecret);

// Expose server address to renderer (so api.js can use it without hardcoding)
ipcMain.handle('get-server-url', () => SERVER_BASE);
// Expose full config so renderer can pick the right protocol
ipcMain.handle('get-server-config', () => ({ host: serverHost, port: serverPort, useHttps }));

// Push Notifications (only when window isn't focused)
ipcMain.on('notify', (event, { title, body }) => {
    const windows = BrowserWindow.getAllWindows();
    const isFocused = windows.some(w => w.isFocused());
    if (!isFocused && Notification.isSupported()) {
        new Notification({ title, body, silent: false }).show();
    }
});

// Screen Sources for picker UI
ipcMain.handle('get-sources', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 320, height: 180 }
        });
        return sources.map(s => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail.toDataURL()
        }));
    } catch (e) {
        console.error('[Electron] getSources error:', e);
        return [];
    }
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.cjs'),
            webSecurity: false
        },
        title: `SafeZone ${buildConfig.type === 'admin' ? 'Admin' : 'Client'}`,
        backgroundColor: '#121212',
        show: false,
        autoHideMenuBar: true
    });

    const isPackaged = app.isPackaged;

    if (isPackaged) {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
        console.log('[Electron] Loaded production file');
    } else {
        const devUrl = 'http://localhost:5173';
        console.log(`[Electron] Loading Development URL: ${devUrl}`);
        win.loadURL(devUrl);
    }

    win.once('ready-to-show', () => {
        win.show();
        if (isPackaged) {
            autoUpdater.checkForUpdatesAndNotify();
        }
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`[Electron] Failed to load: ${errorDescription} (${errorCode})`);
        if (errorCode === -102 || errorCode === -118) {
            setTimeout(() => isPackaged ? win.reload() : win.loadURL('http://localhost:5173'), 1000);
        }
    });

    win.setMenuBarVisibility(false);

    win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            const sourceId = request.frame.url.split('chromeMediaSourceId=')[1];
            const selectedSource = sources.find(source => source.id === sourceId);
            callback({ video: selectedSource || sources[0], audio: 'loopback' });
        }).catch((err) => {
            console.error(err);
        });
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
