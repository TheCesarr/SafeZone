const { app, BrowserWindow, desktopCapturer, session, ipcMain, Notification } = require('electron');
const path = require('path');
let buildConfig = { type: 'client', adminSecret: '' };
try {
    buildConfig = require('./build_config.cjs');
    console.log(`[Electron] Build Type: ${buildConfig.type}`);
} catch (e) {
    console.error("[Electron] Could not load build_config.cjs, defaulting to client.", e);
}

// Ignore SSL errors (MANDATORY for Self-Signed Certs)
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
// Allow Microphone/Camera on HTTP for VDS IP
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://31.57.156.201');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.disableHardwareAcceleration();

// Forcefully accept all certificates (Critical for WSS connection)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

// IPC Handlers for Dual Build
ipcMain.handle('get-build-type', () => buildConfig.type);
ipcMain.handle('get-admin-secret', () => buildConfig.adminSecret);

// IPC Handler for Push Notifications
// Only fires if the app window isn't focused (so no redundant pings)
ipcMain.on('notify', (event, { title, body }) => {
    const windows = BrowserWindow.getAllWindows();
    const isFocused = windows.some(w => w.isFocused());
    if (!isFocused && Notification.isSupported()) {
        new Notification({ title, body, silent: false }).show();
    }
});


function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Security: Disable nodeIntegration (we use preload)
            contextIsolation: false, // We enabled contextIsolation=false in preload logic for now to expose window.SAFEZONE_API easily, or we can use true + contextBridge.
            // Wait, my preload uses window.SAFEZONE_API and I said "contextIsolation: false".
            // If I set nodeIntegration: false, I rely on preload.
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
        // Open DevTools to debug black screen
        // win.webContents.openDevTools();
    });

    // Retry logic for dev server startup race condition
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`[Electron] Failed to load: ${errorDescription} (${errorCode})`);
        if (errorCode === -102 || errorCode === -118) {
            setTimeout(() => isPackaged ? win.reload() : win.loadURL('http://localhost:5173'), 1000);
        }
    });

    win.setMenuBarVisibility(false);

    // Handle Screen Share Requests (getDisplayMedia)
    win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            // Grant access to the first screen available.
            callback({ video: sources[0], audio: 'loopback' });
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
