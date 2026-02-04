import React, { useState } from 'react';
import { getUrl } from '../utils/api';

const UserFooter = ({
    authState,
    activeVoiceChannel,
    selectedServer,
    isMuted,
    isDeafened,
    isNoiseCancelled,
    isScreenSharing,
    ping,
    onDisconnect,
    onToggleMute,
    onToggleDeafen,
    onToggleNoiseCancellation,
    onScreenShare,
    stopScreenShare,
    onStatusChange
}) => {
    const [showStatusMenu, setShowStatusMenu] = useState(false);

    if (!authState || !authState.user) return <div style={{ padding: '10px', backgroundColor: '#0f0f0f', borderTop: '1px solid #222', color: '#666', fontSize: '12px' }}>Yükleniyor...</div>;

    const currentStatus = authState.user.status || 'online';

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#3BA55C'; // Green
            case 'idle': return '#FAA61A';   // Yellow
            case 'dnd': return '#ED4245';    // Red
            case 'invisible': return '#747F8D'; // Grey
            default: return '#3BA55C';
        }
    };

    const handleStatusClick = (status) => {
        if (onStatusChange) onStatusChange(status);
        setShowStatusMenu(false);
    };

    return (
        <div style={{ padding: '10px', backgroundColor: '#0f0f0f', borderTop: '1px solid #222', position: 'relative' }}>

            {/* Status Menu Popover */}
            {showStatusMenu && (
                <div style={{
                    position: 'absolute',
                    bottom: '60px',
                    left: '10px',
                    backgroundColor: '#18191C',
                    border: '1px solid #2f3136',
                    borderRadius: '4px',
                    padding: '5px',
                    zIndex: 1000,
                    width: '200px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ padding: '5px', color: '#b9bbbe', fontSize: '12px', fontWeight: 'bold' }}>DURUM AYARLA</div>
                    <div onClick={() => handleStatusClick('online')} style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dcddde', borderRadius: '3px', transition: '0.2s' }} onMouseEnter={(e) => e.target.style.background = '#40444b'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3BA55C' }}></div>
                        Çevrimiçi
                    </div>
                    <div onClick={() => handleStatusClick('idle')} style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dcddde', borderRadius: '3px', transition: '0.2s' }} onMouseEnter={(e) => e.target.style.background = '#40444b'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FAA61A' }}></div>
                        Boşta
                    </div>
                    <div onClick={() => handleStatusClick('dnd')} style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dcddde', borderRadius: '3px', transition: '0.2s' }} onMouseEnter={(e) => e.target.style.background = '#40444b'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ED4245' }}></div>
                        Rahatsız Etmeyin
                    </div>
                    <div onClick={() => handleStatusClick('invisible')} style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dcddde', borderRadius: '3px', transition: '0.2s' }} onMouseEnter={(e) => e.target.style.background = '#40444b'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#747F8D' }}></div>
                        Görünmez
                    </div>
                </div>
            )}
            {/* Status Menu Overlay (Click outside to close) */}
            {showStatusMenu && <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999 }} onClick={() => setShowStatusMenu(false)}></div>}


            {/* 1. Voice Connection Status Panel */}
            {activeVoiceChannel && (
                <div style={{ marginBottom: '10px', padding: '8px', borderRadius: '4px', backgroundColor: '#1e1e1e', border: '1px solid #34C759', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ color: '#34C759', fontSize: '10px', fontWeight: 'bold' }}>SES BAĞLI / <span style={{ color: 'white' }}>{activeVoiceChannel.name}</span></div>
                        <div style={{ fontSize: '9px', color: '#aaa' }}>SafeZone / {selectedServer?.name}</div>
                    </div>
                    <button onClick={onDisconnect} title="Bağlantıyı Kes" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>❌</button>
                </div>
            )}

            {/* 2. User Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Avatar with Status Indicator */}
                <div
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    style={{ position: 'relative', cursor: 'pointer' }}
                >
                    <div style={{ width: '32px', minWidth: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', overflow: 'hidden', flexShrink: 0 }}>
                        {authState.user.avatar_url ? (
                            <img src={`${getUrl(authState.user.avatar_url)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            authState.user.username.slice(0, 2).toUpperCase()
                        )}
                    </div>
                    {/* Status Dot */}
                    <div style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(currentStatus),
                        border: '2px solid #0f0f0f'
                    }}></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '10px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'block', overflow: 'hidden' }}>{authState.user.username}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '10px', color: '#666', flexShrink: 0 }}>#{authState.user.discriminator || '0001'}</span>
                        {ping !== null && (
                            <span style={{ fontSize: '9px', color: ping < 100 ? '#34C759' : (ping < 250 ? '#FFD60A' : '#FF453A'), fontWeight: 'bold', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                {ping < 100 ? '🟢' : (ping < 250 ? '🟡' : '🔴')} {ping}ms
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px', flexShrink: 0 }}>
                    <button
                        onClick={isScreenSharing ? stopScreenShare : onScreenShare}
                        disabled={!activeVoiceChannel}
                        title={isScreenSharing ? "Paylaşımı Durdur" : "Ekran Paylaş"}
                        style={{
                            background: isScreenSharing ? '#34C759' : 'none',
                            border: 'none',
                            cursor: activeVoiceChannel ? 'pointer' : 'not-allowed',
                            fontSize: '18px',
                            color: isScreenSharing ? 'white' : (activeVoiceChannel ? 'white' : '#555'),
                            padding: '5px', borderRadius: '4px'
                        }}
                    >
                        🖥️
                    </button>
                    <button
                        onClick={onToggleMute}
                        disabled={!activeVoiceChannel}
                        title={activeVoiceChannel ? (isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat') : 'Ses odasına bağlanın'}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: activeVoiceChannel ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            opacity: activeVoiceChannel ? 1 : 0.5,
                            filter: isMuted ? 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' : 'none',
                            transition: 'filter 0.2s'
                        }}
                    >
                        🎙️
                    </button>
                    <button
                        onClick={onToggleDeafen}
                        disabled={!activeVoiceChannel}
                        title={activeVoiceChannel ? (isDeafened ? 'Sesi Aç' : 'Sesi Kapat') : 'Ses odasına bağlanın'}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: activeVoiceChannel ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            opacity: activeVoiceChannel ? 1 : 0.5,
                            filter: isDeafened ? 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' : 'none',
                            transition: 'filter 0.2s'
                        }}
                    >
                        🎧
                    </button>
                    <button
                        onClick={onToggleNoiseCancellation}
                        disabled={!activeVoiceChannel}
                        title={activeVoiceChannel ? (isNoiseCancelled ? 'Gürültü Engelleme: AÇIK' : 'Gürültü Engelleme: KAPALI') : 'Ses odasına bağlanın'}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: activeVoiceChannel ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            opacity: activeVoiceChannel ? 1 : 0.5,
                            filter: isNoiseCancelled ? 'drop-shadow(0 0 5px #34C759)' : 'grayscale(100%)',
                            transition: 'all 0.2s',
                        }}
                    >
                        ✨
                    </button>

                </div>
            </div>
        </div>
    );
};

export default UserFooter;
