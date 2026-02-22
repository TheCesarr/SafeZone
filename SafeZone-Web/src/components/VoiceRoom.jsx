import React, { useState, useRef, useEffect } from 'react';

const VoiceRoom = ({
    selectedChannel,
    remoteStreams,
    remoteScreenStreams = {},
    activeUsersRef,
    isScreenSharing,
    screenStreamRef,
    connectedUsers = [],
    voiceStates = {},
    activeVoiceChannel,
    remoteAudioRefs,
    serverMembers,
    speakingUsers = new Set(),
    screenSources = [],          // Array of { id, name, thumbnail } for picker
    startScreenShareWithSource,  // (sourceId) => void
    onCancelScreenPicker,        // () => void
    colors
}) => {
    // Stage Management
    const [focusedStreamId, setFocusedStreamId] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, userId: null });
    const contextMenuRef = useRef(null);

    // Auto-focus local screen share in Stage when sharing starts
    useEffect(() => {
        if (isScreenSharing) {
            setFocusedStreamId('local');
        } else {
            setFocusedStreamId(prev => prev === 'local' ? null : prev);
        }
    }, [isScreenSharing]);

    // Close Context Menu on Click Outside
    useEffect(() => {
        const handleClick = (e) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []); // Empty deps: listener registered once, uses functional updater to avoid stale closure

    // Helpers
    const getUser = (uuid) => {
        if (!uuid) return { username: 'Unknown' };
        return serverMembers?.find(m => m.uuid === uuid || m.username === uuid) ||
            activeUsersRef?.current?.find(u => u.uuid === uuid) ||
            { username: uuid };
    };

    const getDisplayName = (uuid) => {
        if (!uuid) return "Unknown";
        const u = getUser(uuid);
        return u?.display_name || u?.username || uuid;
    };

    const handleContextMenu = (e, userId) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            userId: userId
        });
    };

    const adjustVolume = (userId, val) => {
        if (!remoteAudioRefs?.current) return;
        const audios = remoteAudioRefs.current[userId];
        if (Array.isArray(audios)) {
            audios.forEach(a => { if (a) a.volume = val; });
        } else if (audios) {
            audios.volume = val;
        }
    };

    const toggleLocalMute = (userId) => {
        if (!remoteAudioRefs?.current) return;
        const audios = remoteAudioRefs.current[userId];
        const isMuted = Array.isArray(audios) ? audios[0]?.muted : audios?.muted;
        const newState = !isMuted;

        if (Array.isArray(audios)) {
            audios.forEach(a => { if (a) a.muted = newState; });
        } else if (audios) {
            audios.muted = newState;
        }
        setContextMenu({ ...contextMenu, visible: false });
    };

    // Calculate Grid Dimensions
    const getGridStyle = (count) => {
        const safeCount = count || 0;
        if (safeCount <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
        if (safeCount === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
        if (safeCount <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
        if (safeCount <= 9) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
        return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto' };
    };

    // Safe Data Access
    const safeRemoteScreenStreams = remoteScreenStreams || {};
    const safeConnectedUsers = Array.isArray(connectedUsers) ? connectedUsers : [];
    const hasActiveScreenShare = Object.keys(safeRemoteScreenStreams).length > 0 || isScreenSharing;
    const showStage = hasActiveScreenShare && focusedStreamId;

    // Avatar Colors (Fallback)
    const AVATAR_COLORS = ['#5865F2', '#EB459E', '#F2CC5D', '#3BA55C', '#FAA61A'];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#000', height: '100%', position: 'relative', overflow: 'hidden' }}>

            {/* === SCREEN PICKER MODAL === */}
            {screenSources.length > 0 && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.88)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 200,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'flex-start',
                    padding: '32px 24px',
                    overflowY: 'auto',
                }}>
                    <div style={{ width: '100%', maxWidth: '900px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: '700' }}>🖥️ Paylaşılacak Ekranı Seç</h2>
                            <button
                                onClick={onCancelScreenPicker}
                                style={{ background: 'rgba(237,66,69,0.15)', border: '1px solid rgba(237,66,69,0.4)', borderRadius: '8px', color: '#ed4245', cursor: 'pointer', padding: '6px 14px', fontSize: '13px', fontWeight: '600' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,66,69,0.3)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(237,66,69,0.15)'}
                            >✕ İptal</button>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: '16px',
                        }}>
                            {screenSources.map(src => (
                                <div
                                    key={src.id}
                                    onClick={() => startScreenShareWithSource?.(src.id)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.15s, transform 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#5865F2'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                    <img
                                        src={src.thumbnail}
                                        alt={src.name}
                                        style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', background: '#111' }}
                                    />
                                    <div style={{ padding: '8px 12px', color: '#dcddde', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {src.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 1. STAGE */}
            {showStage && (
                <div
                    onContextMenu={(e) => {
                        if (focusedStreamId && focusedStreamId !== 'local') {
                            handleContextMenu(e, focusedStreamId);
                        }
                    }}
                    style={{ flex: '1 1 60%', backgroundColor: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', borderBottom: '1px solid #202225' }}
                >
                    {focusedStreamId === 'local' && screenStreamRef?.current ? (
                        <video
                            ref={el => { if (el) el.srcObject = screenStreamRef.current }}
                            autoPlay playsInline muted
                            style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
                        />
                    ) : safeRemoteScreenStreams[focusedStreamId] ? (
                        <video
                            ref={el => { if (el) el.srcObject = safeRemoteScreenStreams[focusedStreamId] }}
                            autoPlay playsInline
                            style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
                        />
                    ) : (
                        <div style={{ color: '#aaa' }}>Yayın yükleniyor...</div>
                    )}

                    <div style={{ position: 'absolute', bottom: '30px', left: '30px', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>
                            {focusedStreamId === 'local' ? 'Senin Ekranın' : `${getDisplayName(focusedStreamId)}'in Ekranı`}
                        </span>
                        <button
                            onClick={() => setFocusedStreamId(null)}
                            style={{ background: 'transparent', border: 'none', color: '#ff5555', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Kapat
                        </button>
                    </div>
                </div>
            )}

            {/* 2. PARTICIPANT GRID */}
            <div style={{
                flex: showStage ? '0 0 150px' : '1',
                backgroundColor: '#36393f',
                padding: '20px',
                display: showStage ? 'flex' : 'grid',
                gap: '10px',
                overflowY: 'auto',
                overflowX: showStage ? 'auto' : 'hidden',
                alignItems: showStage ? 'center' : 'stretch',
                ...(!showStage ? getGridStyle(safeConnectedUsers.length) : {})
            }}>
                {safeConnectedUsers.map(user => {
                    // Ultra-Defensive Checks
                    if (!user || !user.uuid) return null;

                    const isSpeaking = speakingUsers?.has(user.uuid);
                    const isMuted = voiceStates[user.uuid]?.isMuted;
                    const isDeafened = voiceStates[user.uuid]?.isDeafened;
                    const isSharing = voiceStates[user.uuid]?.isScreenSharing;

                    // Safe Color Logic
                    // Use AVATAR_COLORS array directly since 'colors' prop is a theme object
                    const usernameLen = (user.username || "").length;
                    const bg = AVATAR_COLORS[usernameLen % AVATAR_COLORS.length];

                    return (
                        <div
                            key={user.uuid || Math.random()}
                            onContextMenu={(e) => handleContextMenu(e, user.uuid)}
                            style={{
                                position: 'relative',
                                backgroundColor: '#2f3136',
                                borderRadius: '8px',
                                minWidth: showStage ? '200px' : 'auto',
                                height: showStage ? '120px' : '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: isSpeaking ? '3px solid #3BA55C' : '3px solid transparent',
                                boxShadow: isSpeaking ? '0 0 15px rgba(59, 165, 92, 0.3)' : 'none',
                                transition: 'all 0.1s',
                                cursor: 'default'
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: showStage ? '50px' : '80px',
                                    height: showStage ? '50px' : '80px',
                                    borderRadius: '50%',
                                    backgroundColor: bg,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: showStage ? '20px' : '32px',
                                    color: '#fff',
                                    marginBottom: '10px'
                                }}>
                                    {(getDisplayName(user.uuid) || "?").substring(0, 2).toUpperCase()}
                                </div>
                                {isSharing && (
                                    <div style={{ position: 'absolute', bottom: '5px', right: '-5px', backgroundColor: '#ED4245', borderRadius: '50%', padding: '4px', border: '2px solid #2f3136' }}>
                                        <span style={{ fontSize: '12px' }}>🖥️</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                                    {getDisplayName(user.uuid)}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                                {isMuted && <span title="Susturuldu">🎙️❌</span>}
                                {isDeafened && <span title="Sağırlaştırıldı">🎧❌</span>}
                            </div>

                            {/* Watch Stream Button (Manual) */}
                            {isSharing && safeRemoteScreenStreams[user.uuid] && focusedStreamId !== user.uuid && (
                                <button
                                    onClick={() => setFocusedStreamId(user.uuid)}
                                    style={{ marginTop: '5px', background: '#5865F2', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                >
                                    Yayını İzle
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* CONTEXT MENU */}
            {contextMenu.visible && contextMenu.userId && (
                <div
                    ref={contextMenuRef}
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        backgroundColor: '#18191c',
                        border: '1px solid #000',
                        borderRadius: '4px',
                        padding: '6px 0',
                        zIndex: 9999,
                        minWidth: '180px',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
                    }}
                >
                    <div style={{ padding: '8px 12px', color: '#ccc', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #333' }}>
                        {getDisplayName(contextMenu.userId).toUpperCase()}
                    </div>

                    {/* NEW: Stop Watching Button */}
                    {focusedStreamId === contextMenu.userId && (
                        <div
                            onClick={() => setFocusedStreamId(null)}
                            style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', borderBottom: '1px solid #333', fontWeight: 'bold' }}
                        >
                            Yayını Durdur
                        </div>
                    )}

                    <div
                        onClick={() => toggleLocalMute(contextMenu.userId)}
                        style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', hover: { backgroundColor: '#5865F2' }, display: 'flex', justifyContent: 'space-between' }}
                    >
                        <span>Sessize Al</span>
                        <input type="checkbox" checked={remoteAudioRefs?.current?.[contextMenu.userId]?.[0]?.muted || false} readOnly />
                    </div>

                    <div style={{ padding: '8px 12px', borderTop: '1px solid #333' }}>
                        <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '4px' }}>Kullanıcı Sesi</div>
                        <input
                            type="range"
                            min="0" max="200" step="1"
                            defaultValue="100"
                            onChange={(e) => adjustVolume(contextMenu.userId, e.target.value / 100)}
                            style={{ width: '100%', accentColor: '#3BA55C', cursor: 'pointer' }}
                        />
                    </div>
                </div>
            )}
            {/* HIDDEN AUDIO ELEMENTS FOR VOICE */}
            {/* HIDDEN AUDIO ELEMENTS MOVED TO APP.JSX FOR PERSISTENCE */}
        </div>
    );
};

export default VoiceRoom;
