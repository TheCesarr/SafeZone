import React, { useState, useRef, useEffect } from 'react';

const VoiceRoom = ({
    selectedChannel,
    remoteStreams,
    remoteScreenStreams,
    activeUsersRef,
    isScreenSharing,
    screenStreamRef,
    connectedUsers,
    voiceStates,
    activeVoiceChannel,
    remoteAudioRefs,
    serverMembers,
    speakingUsers,
    colors
}) => {
    // Stage Management
    const [focusedStreamId, setFocusedStreamId] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, userId: null });
    const contextMenuRef = useRef(null);

    // REMOVED AUTO-FOCUS EFFECT
    // Users must click "Watch Stream" manually.

    // Close Context Menu on Click Outside
    useEffect(() => {
        const handleClick = (e) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
                setContextMenu({ ...contextMenu, visible: false });
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

    // Helpers
    const getUser = (uuid) => {
        return serverMembers?.find(m => m.uuid === uuid || m.username === uuid) ||
            activeUsersRef.current.find(u => u.uuid === uuid) ||
            { username: uuid };
    };

    const getDisplayName = (uuid) => {
        const u = getUser(uuid);
        return u.display_name || u.username || uuid;
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
        const audios = remoteAudioRefs.current[userId];
        if (Array.isArray(audios)) {
            audios.forEach(a => a.volume = val);
        } else if (audios) {
            audios.volume = val;
        }
    };

    const toggleLocalMute = (userId) => {
        const audios = remoteAudioRefs.current[userId];
        const isMuted = Array.isArray(audios) ? audios[0]?.muted : audios?.muted;
        const newState = !isMuted;

        if (Array.isArray(audios)) {
            audios.forEach(a => a.muted = newState);
        } else if (audios) {
            audios.muted = newState;
        }
        // Force re-render to update menu text? (Not strict react state, but effective)
        setContextMenu({ ...contextMenu, visible: false });
    };

    // Calculate Grid Dimensions
    const getGridStyle = (count) => {
        if (count <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
        if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
        if (count <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
        if (count <= 9) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
        return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto' };
    };

    // Render Logic
    const hasActiveScreenShare = Object.keys(remoteScreenStreams).length > 0 || isScreenSharing;
    const showStage = hasActiveScreenShare && focusedStreamId;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#000', height: '100%', position: 'relative', overflow: 'hidden' }}>

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
                    {focusedStreamId === 'local' && screenStreamRef.current ? (
                        <video
                            ref={el => { if (el) el.srcObject = screenStreamRef.current }}
                            autoPlay playsInline muted
                            style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
                        />
                    ) : remoteScreenStreams[focusedStreamId] ? (
                        <video
                            ref={el => { if (el) el.srcObject = remoteScreenStreams[focusedStreamId] }}
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
                ...(!showStage ? getGridStyle(connectedUsers.length) : {})
            }}>
                {connectedUsers.map(user => {
                    const isSpeaking = speakingUsers.has(user.uuid);
                    const isMuted = voiceStates[user.uuid]?.isMuted;
                    const isDeafened = voiceStates[user.uuid]?.isDeafened;
                    const isSharing = voiceStates[user.uuid]?.isScreenSharing;
                    const bg = colors ? colors[user.username.length % colors.length] : '#5865F2';

                    return (
                        <div
                            key={user.uuid}
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
                            {isSharing && remoteScreenStreams[user.uuid] && focusedStreamId !== user.uuid && (
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
            {contextMenu.visible && (
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

                    <div
                        onClick={() => toggleLocalMute(contextMenu.userId)}
                        style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', hover: { backgroundColor: '#5865F2' }, display: 'flex', justifyContent: 'space-between' }}
                    >
                        <span>Sessize Al</span>
                        <input type="checkbox" checked={remoteAudioRefs.current[contextMenu.userId]?.[0]?.muted || false} readOnly />
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
        </div>
    );
};

export default VoiceRoom;
