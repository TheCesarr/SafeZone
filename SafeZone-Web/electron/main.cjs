const { app, BrowserWindow, desktopCapturer, session } = require('electron');
const path = require('path');

// Ignore SSL errors (MANDATORY for Self-Signed Certs)
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
// Allow Microphone/Camera on HTTP for VDS IP
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://31.57.156.201');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.disableHardwareAcceleration();

// Forcefully accept all certificates (Critical for WSS connection)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // On certificate error we disable default behaviour (stop loading the page)
    // and we then say "it is all fine - true" to the callback
    event.preventDefault();
    callback(true);
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
        title: "SafeZone",
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
        win.webContents.openDevTools();
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
    // Electron requires explicit handling. For now, we auto-select the entire screen.
    // In the future, we can build a custom picker UI.
    win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            // Grant access to the first screen available.
            callback({ video: sources[0], audio: 'loopback' });
        }).catch((err) => {
            console.error(err);
            // callback(null); // Cancel if error
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
