
// Constants
export const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
}

// ── Dynamic Server URL ────────────────────────────────────────────────────────
// Resolution order:
//   1. Electron IPC → main.cjs reads server-config.json (host, port, useHttps)
//   2. Vite env var VITE_SERVER_URL (for browser dev mode)
//   3. Hardcoded fallback (safety net only)
//
// Switching the server IP or enabling HTTPS only requires editing
// electron/server-config.json — no rebuild needed.

let _serverBase = null;   // "host:port"
let _useHttps = false;  // determines http/ws vs https/wss

/**
 * Resolve and cache the server base (host:port) and protocol flag.
 * Call once at app startup (AppProviders).
 */
export async function initServerUrl() {
    if (_serverBase) return _serverBase;

    // Electron path: ask main process (reads server-config.json)
    if (window.SAFEZONE_API?.getServerConfig) {
        try {
            const cfg = await window.SAFEZONE_API.getServerConfig();
            _serverBase = `${cfg.host}:${cfg.port}`;
            _useHttps = cfg.useHttps ?? false;
            console.log(`[api] Server: ${_useHttps ? 'https' : 'http'}://${_serverBase}`);
            return _serverBase;
        } catch (e) {
            console.warn('[api] getServerConfig IPC failed, trying fallbacks.', e);
        }
    }

    // Vite env override (for development: VITE_SERVER_URL=192.168.x.x:8000)
    if (import.meta.env?.VITE_SERVER_URL) {
        _serverBase = import.meta.env.VITE_SERVER_URL;
        _useHttps = import.meta.env.VITE_USE_HTTPS === 'true';
        console.log(`[api] Server from VITE_SERVER_URL: ${_serverBase}`);
        return _serverBase;
    }

    // Ultimate fallback
    _serverBase = '31.57.156.201:8000';
    _useHttps = false;
    console.warn('[api] Using hardcoded fallback server URL:', _serverBase);
    return _serverBase;
}

/** Returns the cached server base. Call initServerUrl() once before using. */
function getBase() {
    return _serverBase || '31.57.156.201:8000';
}

// Helpers
export const getUrl = (endpoint, protocol = 'http') => {
    if (!endpoint) return '';
    if (endpoint.startsWith('http') || endpoint.startsWith('ws')) return endpoint;

    const base = getBase();

    if (protocol === 'ws') {
        return `${_useHttps ? 'wss' : 'ws'}://${base}${endpoint}`;
    } else {
        return `${_useHttps ? 'https' : 'http'}://${base}${endpoint}`;
    }
}
