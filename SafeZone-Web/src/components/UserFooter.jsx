import React, { useState } from 'react';
import { getUrl } from '../utils/api';

const IconMic = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const IconMicOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const IconHeadphones = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>;
const IconHeadphonesOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>; // Simplistic Cross
const IconScreen = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>;
const IconNoise = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0"></path><path d="M4.93 4.93l14.14 14.14"></path></svg>; // Abstract noise
const IconDisconnect = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>;

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
    onStatusChange,
    colors // Receive colors prop
}) => {
    const [showStatusMenu, setShowStatusMenu] = useState(false);

    if (!authState || !authState.user) return <div style={{ padding: '10px', backgroundColor: colors?.sidebar || '#2f3136', borderTop: `1px solid ${colors?.border || 'rgba(0,0,0,0.1)'}`, color: colors?.textMuted || '#aaa', fontSize: '12px' }}>Yükleniyor...</div>;

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

    const bgColor = colors?.sidebar || '#131416';
    const textColor = colors?.text || '#fff';
    const mutedColor = colors?.textMuted || '#b9bbbe';
    const borderColor = colors?.border || 'rgba(255,255,255,0.1)';

    return (
        <div style={{ padding: '12px', backgroundColor: bgColor, borderTop: `1px solid ${borderColor}`, position: 'relative', transition: 'background-color 0.3s' }}>

            {/* Status Menu Popover */}
            {showStatusMenu && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    bottom: '70px',
                    left: '10px',
                    padding: '8px',
                    zIndex: 1000,
                    width: '220px',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    border: `1px solid ${borderColor}`,
                    backgroundColor: colors?.card || '#2a2a2a', // Use card color for popover
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ padding: '8px', color: mutedColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Durum Ayarla</div>
                    {[
                        { id: 'online', label: 'Çevrimiçi', color: '#3BA55C' },
                        { id: 'idle', label: 'Boşta', color: '#FAA61A' },
                        { id: 'dnd', label: 'Rahatsız Etmeyin', color: '#ED4245' },
                        { id: 'invisible', label: 'Görünmez', color: '#747F8D' },
                    ].map(status => (
                        <div
                            key={status.id}
                            onClick={() => handleStatusClick(status.id)}
                            className="interactive-button"
                            style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '12px', color: textColor, borderRadius: '4px' }}
                        >
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: status.color, boxShadow: `0 0 8px ${status.color}40` }}></div>
                            {status.label}
                        </div>
                    ))}
                </div>
            )}

            {showStatusMenu && <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999 }} onClick={() => setShowStatusMenu(false)}></div>}

            {/* 1. Voice Connection Status Panel */}
            {activeVoiceChannel && (
                <div className="animate-fade-in" style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(52, 199, 89, 0.1)', border: '1px solid rgba(52, 199, 89, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ color: '#34C759', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="animate-pulse">●</span> SES BAĞLI
                        </div>
                        <div style={{ fontSize: '12px', color: textColor, fontWeight: '500', marginTop: '2px' }}>{activeVoiceChannel.name}</div>
                        <div style={{ fontSize: '10px', color: mutedColor }}>{selectedServer?.name}</div>
                    </div>
                    <button onClick={onDisconnect} className="interactive-button" title="Bağlantıyı Kes" style={{ background: 'transparent', border: 'none', color: '#ed4245', padding: '8px' }}>
                        <IconDisconnect />
                    </button>
                </div>
            )}

            {/* 2. User Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Avatar with Status Indicator */}
                <div
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className="interactive-button"
                    style={{ position: 'relative', borderRadius: '50%', padding: 0 }}
                >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#36393f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                        {authState.user.avatar_url ? (
                            <img src={`${getUrl(authState.user.avatar_url)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            authState.user.username.slice(0, 2).toUpperCase()
                        )}
                    </div>
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(currentStatus),
                        border: `3px solid ${bgColor}`, // Match footer bg
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                    }}></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '10px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{authState.user.display_name || authState.user.username}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: mutedColor, flexShrink: 0 }}>#{authState.user.discriminator || '0001'}</span>
                    </div>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                    {/* Microphone */}
                    <button
                        onClick={onToggleMute}
                        className="interactive-button"
                        title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isMuted ? '#ed4245' : mutedColor,
                            padding: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative'
                        }}
                    >
                        {isMuted && <div style={{ position: 'absolute', width: '100%', height: '2px', background: '#ed4245', transform: 'rotate(45deg)', opacity: 0.8 }}></div>}
                        {isMuted ? <IconMicOff /> : <IconMic />}
                    </button>

                    {/* Headphones */}
                    <button
                        onClick={onToggleDeafen}
                        className="interactive-button"
                        title={isDeafened ? 'Sesi Aç' : 'Sesi Kapat'}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isDeafened ? '#ed4245' : mutedColor,
                            padding: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative'
                        }}
                    >
                        {isDeafened && <div style={{ position: 'absolute', width: '100%', height: '2px', background: '#ed4245', transform: 'rotate(45deg)', opacity: 0.8 }}></div>}
                        {isDeafened ? <IconHeadphonesOff /> : <IconHeadphones />}
                    </button>

                    {/* Settings */}
                    <button
                        onClick={onToggleNoiseCancellation}
                        className="interactive-button"
                        title={isNoiseCancelled ? 'Gürültü Engelleme: AÇIK' : 'Gürültü Engelleme: KAPALI'}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isNoiseCancelled ? '#3BA55C' : mutedColor,
                            padding: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <IconNoise />
                    </button>

                    {/* Screen Share (Only when active) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isScreenSharing) {
                                stopScreenShare();
                            } else {
                                onScreenShare();
                            }
                        }}
                        disabled={!activeVoiceChannel}
                        className="interactive-button"
                        title={isScreenSharing ? "Paylaşımı Durdur" : "Ekran Paylaş"}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isScreenSharing ? '#ed4245' : (activeVoiceChannel ? mutedColor : (colors?.textMuted || '#4f545c')),
                            padding: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: activeVoiceChannel ? 'pointer' : 'not-allowed',
                            position: 'relative'
                        }}
                    >
                        {isScreenSharing && <div style={{ position: 'absolute', width: '100%', height: '2px', background: '#ed4245', transform: 'rotate(45deg)', opacity: 0.8 }}></div>}
                        <IconScreen />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFooter;
