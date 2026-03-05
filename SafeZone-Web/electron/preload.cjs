const { ipcRenderer } = require('electron');

// ── Event Buffer ──────────────────────────────────────────────────────────────
// Update events can fire before the React component mounts.
// We buffer them here and replay immediately when a listener registers.
const _updateBuffer = {};

function bufferAndListen(channel) {
    ipcRenderer.on(channel, (event, data) => {
        _updateBuffer[channel] = data; // Store latest event data
    });
}
bufferAndListen('update-available');
bufferAndListen('update-downloaded');
bufferAndListen('update-progress');

function onBuffered(channel, cb) {
    // Replay buffered event if it already arrived
    if (_updateBuffer[channel] !== undefined) {
        cb(_updateBuffer[channel]);
    }
    // Also listen for future events
    ipcRenderer.on(channel, (event, data) => cb(data));
}

// Expose API to renderer
window.SAFEZONE_API = {
    getBuildType: () => ipcRenderer.invoke('get-build-type'),
    getAdminSecret: () => ipcRenderer.invoke('get-admin-secret'),
    notify: (title, body) => ipcRenderer.send('notify', { title, body }),
    // Screen Share: get list of screens/windows with thumbnails
    getSources: () => ipcRenderer.invoke('get-sources'),
    // Dynamic server config — reads from server-config.json via main process (no rebuild needed)
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    getServerConfig: () => ipcRenderer.invoke('get-server-config'),

    // AutoUpdater — buffered so events fired before React mounts are not lost
    onUpdateAvailable: (cb) => onBuffered('update-available', cb),
    onUpdateDownloaded: (cb) => onBuffered('update-downloaded', cb),
    onUpdateProgress: (cb) => onBuffered('update-progress', cb),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
};
