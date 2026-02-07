import React, { useState, useRef, useEffect } from 'react';

const VoiceRoom = ({
    selectedChannel,
    remoteStreams,
    activeUsersRef,
    isScreenSharing,
    screenStreamRef,
    connectedUsers,
    voiceStates,
    handleUserVolumeChange,
    userVolumes = {},
    activeVoiceChannel
}) => {
    const [watchingStreamId, setWatchingStreamId] = useState(null);
    const [streamWindow, setStreamWindow] = useState({ x: 50, y: 50, width: 800, height: 450 });
    const isResizingRef = useRef(false);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const windowStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

    // Handle Window Drag/Resize
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizingRef.current) {
                const deltaX = e.clientX - dragStartRef.current.x;
                const deltaY = e.clientY - dragStartRef.current.y;
                setStreamWindow(prev => ({
                    ...prev,
                    width: Math.max(300, windowStartRef.current.width + deltaX),
                    height: Math.max(170, windowStartRef.current.height + deltaY)
                }));
            } else if (isDraggingRef.current) {
                const deltaX = e.clientX - dragStartRef.current.x;
                const deltaY = e.clientY - dragStartRef.current.y;
                setStreamWindow(prev => ({
                    ...prev,
                    x: windowStartRef.current.x + deltaX,
                    y: windowStartRef.current.y + deltaY
                }));
            }
        };
        const handleMouseUp = () => {
            isResizingRef.current = false;
            isDraggingRef.current = false;
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startResize = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        windowStartRef.current = { ...streamWindow };
    };

    const startDrag = (e) => {
        if (e.target.closest('button') || e.target.closest('.resize-handle')) return;
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        windowStartRef.current = { ...streamWindow };
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#36393f', position: 'relative', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '15px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(22, 22, 22, 0.6)', backdropFilter: 'blur(20px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🔊</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold' }}>{selectedChannel?.name}</span>
                        <span style={{ fontSize: '12px', color: '#888' }}>Sesli Sohbet</span>
                    </div>
                </div>
            </div>

            {/* VIDEO GRID STAGE */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '20px',
                overflow: 'auto',
                backgroundColor: '#000'
            }}>
                {/* 1. REMOTE STREAMS */}
                {Object.entries(remoteStreams).map(([uuid, stream]) => {
                    const isScreen = voiceStates[uuid]?.isScreenSharing;
                    const isWatching = watchingStreamId === uuid;

                    // If it's a screen share but we are NOT watching it, show the "Watch" button placeholder
                    if (isScreen && !isWatching) {
                        return (
                            <div key={uuid} style={{ position: 'relative', width: '300px', height: '170px', backgroundColor: '#202225', borderRadius: '8px', border: '2px solid #202225', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <div style={{ fontSize: '40px' }}>🖥️</div>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{activeUsersRef.current.find(u => u.uuid === uuid)?.username || "Kullanıcı"} Yayında</div>
                                <button
                                    onClick={() => setWatchingStreamId(uuid)}
                                    style={{ padding: '8px 16px', background: '#3BA55C', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Yayını İzle
                                </button>
                            </div>
                        );
                    }

                    // If it's a screen share AND we ARE watching it, don't render it here in grid (it's in window)
                    if (isScreen && isWatching) return null;

                    // Normal Camera Video (or screen share if logic changes, but we handle screen separation)
                    return (
                        <div key={uuid} style={{ position: 'relative', width: '48%', minWidth: '300px', aspectRatio: '16/9', backgroundColor: '#202225', borderRadius: '8px', overflow: 'hidden', border: '2px solid #202225' }}>
                            <video
                                ref={el => { if (el) el.srcObject = stream }}
                                autoPlay
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                            />
                            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                                {activeUsersRef.current.find(u => u.uuid === uuid)?.username || uuid}
                            </div>
                        </div>
                    );
                })}

                {/* 2. LOCAL SCREEN SHARE PREVIEW */}
                {isScreenSharing && screenStreamRef.current && (
                    <div style={{ position: 'relative', width: '48%', minWidth: '300px', aspectRatio: '16/9', backgroundColor: '#202225', borderRadius: '8px', overflow: 'hidden', border: '2px solid #34C759' }}>
                        <video
                            ref={el => { if (el) el.srcObject = screenStreamRef.current }}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                        />
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', color: '#34C759', fontSize: '12px', fontWeight: 'bold' }}>
                            Senin Ekranın (Önizleme)
                        </div>
                    </div>
                )}

                {/* 3. EMPTY STATE */}
                {Object.keys(remoteStreams).length === 0 && !isScreenSharing && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555', gap: '20px' }}>
                        <div style={{ fontSize: '64px' }}>🔊</div>
                        <h3>Sesli Sohbet</h3>
                        <p>Henüz kimse ekran paylaşmıyor.</p>
                        {connectedUsers.length > 0 && (
                            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                                {connectedUsers.map(u => (
                                    <div key={u.uuid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', border: voiceStates[u.uuid]?.isScreenSharing ? '3px solid #34C759' : '3px solid transparent' }}>
                                            {(u.username || "?").slice(0, 2).toUpperCase()}
                                        </div>
                                        <span style={{ color: '#aaa', marginTop: '8px', fontSize: '13px' }}>{u.username}</span>
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                            {voiceStates[u.uuid]?.isScreenSharing && <span style={{ fontSize: '12px' }} title="Yayında">📺</span>}
                                            {voiceStates[u.uuid]?.isMuted && <span style={{ fontSize: '12px', filter: 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' }} title="Susturuldu">🎙️</span>}
                                            {voiceStates[u.uuid]?.isDeafened && <span style={{ fontSize: '12px', filter: 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' }} title="Sağırlaştırıldı">🎧</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FLOATING STREAM WINDOW */}
            {watchingStreamId && remoteStreams[watchingStreamId] && (
                <div
                    onMouseDown={startDrag}
                    style={{
                        position: 'absolute',
                        left: streamWindow.x,
                        top: streamWindow.y,
                        width: streamWindow.width,
                        height: streamWindow.height,
                        backgroundColor: '#000',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 1000,
                        display: 'flex', flexDirection: 'column'
                    }}
                >
                    {/* Header/Overlay */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, cursor: 'move' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold', textShadow: '0 1px 2px #000' }}>
                            {activeUsersRef.current.find(u => u.uuid === watchingStreamId)?.username || "Yayın"}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setWatchingStreamId(null); }}
                            style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}
                        >
                            ✕
                        </button>
                    </div>

                    <video
                        ref={el => { if (el) el.srcObject = remoteStreams[watchingStreamId] }}
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', pointerEvents: 'none' }}
                    />

                    {/* Resize Handle */}
                    <div
                        onMouseDown={startResize}
                        className="resize-handle"
                        style={{
                            position: 'absolute',
                            bottom: 0, right: 0,
                            width: '20px', height: '20px',
                            cursor: 'nwse-resize',
                            background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.5) 50%)',
                            zIndex: 10
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default VoiceRoom;
