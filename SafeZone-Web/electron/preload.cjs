const { ipcRenderer } = require('electron');

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

    // AutoUpdater
    onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (e, info) => cb(info)),
    onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (e, info) => cb(info)),
    onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (e, progress) => cb(progress)),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
};
