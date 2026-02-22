const { ipcRenderer } = require('electron');

// Expose API to renderer
window.SAFEZONE_API = {
    getBuildType: () => ipcRenderer.invoke('get-build-type'),
    getAdminSecret: () => ipcRenderer.invoke('get-admin-secret'),
    notify: (title, body) => ipcRenderer.send('notify', { title, body }),
    // Screen Share: get list of screens/windows with thumbnails
    getSources: () => ipcRenderer.invoke('get-sources'),
};
