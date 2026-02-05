
// Constants
export const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
}

// Helpers
export const getUrl = (endpoint, protocol = 'http') => {
    if (!endpoint) return '';
    if (endpoint.startsWith('http')) return endpoint;

    // Decide base URL (Read from localStorage dynamic logic)
    let base = localStorage.getItem('safezone_server_ip');
    if (!base) return ''; // Do not default to localhost if no IP is set

    const isTunnel = base.includes('loca.lt') || base.includes('ngrok') || base.includes('lhr.life') || base.includes('serveo.net') || base.includes('serveousercontent.com');
    const port = isTunnel ? '' : ':8000';
    base = base.replace(/https?:\/\//, '').replace(/\/$/, '');

    if (protocol === 'ws') {
        const proto = (isTunnel || window.location.protocol === 'https:') ? 'wss://' : 'ws://';
        return `${proto}${base}${port}${endpoint}`;
    } else {
        const proto = (isTunnel || window.location.protocol === 'https:') ? 'https://' : 'http://';
        return `${proto}${base}${port}${endpoint}`;
    }
}
