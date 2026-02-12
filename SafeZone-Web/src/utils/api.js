
// Constants
export const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
}

// Helpers
// Helpers
export const getUrl = (endpoint, protocol = 'http') => {
    if (!endpoint) return '';
    if (endpoint.startsWith('http')) return endpoint;

    // v2.0.0: Hardcoded Server IP
    let base = "31.57.156.201:8000";
    // TODO: Change this to your actual server IP provided by user later

    // v2.0.0: Server is HTTP (Not HTTPS) -> Force insecure
    if (protocol === 'ws') {
        return `ws://${base}${endpoint}`;
    } else {
        return `http://${base}${endpoint}`;
    }
}
