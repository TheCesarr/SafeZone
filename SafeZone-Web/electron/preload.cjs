const { ipcRenderer } = require('electron');

// Expose API to renderer
window.SAFEZONE_API = {
    getBuildType: () => ipcRenderer.invoke('get-build-type'),
    getAdminSecret: () => ipcRenderer.invoke('get-admin-secret')
};
