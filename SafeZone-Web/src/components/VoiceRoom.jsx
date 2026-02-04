import React from 'react';

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
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#36393f', position: 'relative' }}>
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
                {Object.entries(remoteStreams).map(([uuid, stream]) => (
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
                ))}

                {/* 2. LOCAL SCREEN SHARE PREVIEW */}
                {isScreenSharing && screenStreamRef.current && (
                    <div style={{ position: 'relative', width: '48%', minWidth: '300px', aspectRatio: '16/9', backgroundColor: '#202225', borderRadius: '8px', overflow: 'hidden', border: '2px solid #34C759' }}>
                        <video
                            ref={el => { if (el) el.srcObject = screenStreamRef.current }}
                            autoPlay
                            playsInline
                            muted // Mute local preview to avoid feedback if it captured audio
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                        />
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', color: '#34C759', fontSize: '12px', fontWeight: 'bold' }}>
                            Senin Ekranın (Önizleme)
                        </div>
                    </div>
                )}

                {/* 3. EMPTY STATE (Avatars) if no video */}
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceRoom;
