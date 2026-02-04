import React from 'react';
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
    stopScreenShare
}) => {
    if (!authState || !authState.user) return <div style={{ padding: '10px', backgroundColor: '#0f0f0f', borderTop: '1px solid #222', color: '#666', fontSize: '12px' }}>Yükleniyor...</div>;

    return (
        <div style={{ padding: '10px', backgroundColor: '#0f0f0f', borderTop: '1px solid #222' }}>

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
                <div style={{ width: '32px', minWidth: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', overflow: 'hidden', flexShrink: 0 }}>
                    {authState.user.avatar_url ? (
                        <img src={`${getUrl(authState.user.avatar_url)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        authState.user.username.slice(0, 2).toUpperCase()
                    )}
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
