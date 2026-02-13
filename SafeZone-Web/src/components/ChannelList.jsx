import React from 'react';
import UserFooter from './UserFooter';


const ChannelList = ({
    colors,
    width,
    showFriendsList,
    friendRequests,
    friends,
    onlineUserIds,
    handleRespondRequest,
    setShowAddFriend,
    handleStartDM,
    handleRemoveFriend,
    selectedServer,
    handleServerSettings,
    serverMembers,
    setShowChannelCreateModal,
    handleChannelClick,
    setContextMenu,
    handleUserContextMenu,
    selectedChannel,
    activeVoiceChannel,
    roomDetails,
    speakingUsers,
    voiceStates,
    // UserFooter props
    authState,
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
    userStatuses,
    unreadChannels, // Set<channelId>
    unreadDMs, // Set<username>
    children
}) => {
    return (
        <div style={{ width: `${width}px`, flexShrink: 0, background: colors.sidebar, backdropFilter: 'blur(20px) saturate(180%)', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${colors.border}`, position: 'relative', order: 2 }}>
            {showFriendsList ? (
                <>
                    <div style={{ padding: '20px', borderBottom: `1px solid ${colors.border}`, fontWeight: 'bold', fontSize: '16px', background: colors.cardHover, color: colors.text }}>
                        Arkadaşlar
                    </div>

                    {/* PENDING REQUESTS SECTION */}
                    {friendRequests.length > 0 && (
                        <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', margin: '10px', borderRadius: '8px', boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.2)' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors?.textMuted || '#aaa', marginBottom: '8px' }}>GELEN İSTEKLER ({friendRequests.length})</div>
                            {friendRequests.map(req => (
                                <div key={req.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                            {req.username.slice(0, 2).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '12px', color: colors?.text || '#fff' }}>{req.username}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button onClick={() => handleRespondRequest(req.username, 'accept')} style={{ border: 'none', background: '#34C759', color: '#fff', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>✓</button>
                                        <button onClick={() => handleRespondRequest(req.username, 'reject')} style={{ border: 'none', background: '#f04747', color: '#fff', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ flexGrow: 1, padding: '10px', overflowY: 'auto' }}>
                        <div
                            onClick={() => setShowAddFriend(true)}
                            style={{
                                padding: '12px',
                                marginBottom: '8px',
                                borderRadius: '6px',
                                backgroundColor: '#34C759',
                                color: '#fff',
                                cursor: 'pointer',
                                textAlign: 'center',
                                fontWeight: 'bold'
                            }}
                        >
                            + Arkadaş Ekle
                        </div>

                        {friends.length === 0 ? (
                            <div style={{ padding: '20px', color: colors?.textMuted || '#666', textAlign: 'center' }}>
                                <p>Henüz arkadaşın yok!</p>
                                <p style={{ fontSize: '12px' }}>Arkadaş ekle butonuna tıkla.</p>
                            </div>
                        ) : (
                            friends.map(friend => (
                                <div key={friend.username} style={{ padding: '10px', marginBottom: '2px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                            {unreadDMs?.has(friend.username) && <div style={{ position: 'absolute', top: -2, right: -2, width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ED4245', border: '2px solid #2f3136' }}></div>}
                                            {friend.username.slice(0, 2).toUpperCase()}
                                            {onlineUserIds.includes(friend.username) && (
                                                <div style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: userStatuses?.[friend.username] === 'idle' ? '#FAA61A' :
                                                        (userStatuses?.[friend.username] === 'dnd' ? '#ED4245' :
                                                            (userStatuses?.[friend.username] === 'invisible' ? '#747F8D' : '#34C759')),
                                                    position: 'absolute',
                                                    bottom: '-2px',
                                                    right: '-2px',
                                                    border: '2px solid #1e1e1e'
                                                }}></div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: onlineUserIds.includes(friend.username) ? 'bold' : 'normal', color: onlineUserIds.includes(friend.username) ? (colors?.text || '#fff') : (colors?.textMuted || '#aaa') }}>
                                                {friend.display_name || friend.username}
                                            </span>
                                            <span style={{ fontSize: '10px', color: colors?.textMuted || '#666' }}>#{friend.discriminator}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button
                                            onClick={() => handleStartDM(friend)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                            title="Mesaj Gönder"
                                        >
                                            💬
                                        </button>
                                        <button
                                            onClick={() => handleRemoveFriend(friend.username)}
                                            style={{ background: 'none', border: 'none', color: '#f04747', cursor: 'pointer', fontSize: '14px' }}
                                            title="Arkadaşı Kaldır"
                                        >
                                            ❌
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : selectedServer ? (
                <>
                    <div style={{ padding: '20px', borderBottom: `1px solid ${colors?.border || '#222'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '57px', boxSizing: 'border-box' }}>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: colors?.text || '#fff' }}>{selectedServer.name}</div>
                            <div style={{ fontSize: '10px', color: colors?.textMuted || '#666', marginTop: '4px' }}>CODE: {selectedServer.invite_code}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                                onClick={handleServerSettings}
                                title="Sunucu Ayarları (Roller)"
                                style={{ background: 'none', border: 'none', color: colors?.textMuted || '#b9bbbe', fontSize: '16px', cursor: 'pointer', padding: '5px' }}
                            >
                                ⚙️
                            </button>
                            <button
                                onClick={() => setShowChannelCreateModal(true)}
                                title="Kanal Ekle"
                                style={{ background: 'none', border: 'none', color: '#34C759', fontSize: '20px', cursor: 'pointer', padding: '5px' }}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div style={{ flexGrow: 1, padding: '10px', overflowY: 'auto' }}>
                        {selectedServer.channels?.map(ch => (
                            <div key={ch.id}>
                                <div
                                    onClick={() => handleChannelClick(ch)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, channelId: ch.id, channel: ch });
                                    }}
                                    style={{
                                        padding: '10px', marginBottom: '2px', borderRadius: '6px',
                                        backgroundColor: selectedChannel?.id === ch.id ? (colors?.cardHover || '#333') : 'transparent',
                                        color: selectedChannel?.id === ch.id ? (colors?.text || '#fff') : (activeVoiceChannel?.id === ch.id ? '#34C759' : (colors?.textMuted || '#888')),
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <span style={{ flexShrink: 0 }}>{ch.type === 'voice' ? '🔊' : '💬'}</span>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: unreadChannels?.has(ch.id) ? 'bold' : 'normal', color: unreadChannels?.has(ch.id) ? '#fff' : 'inherit' }}>{ch.name}</span>
                                    {unreadChannels?.has(ch.id) && <div style={{ minWidth: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fff', marginLeft: 'auto' }}></div>}
                                </div>
                                {/* ACTIVE VOICE USERS AVATARS (Always from Lobby RoomDetails) */}
                                {ch.type === 'voice' && roomDetails[ch.id] && roomDetails[ch.id].length > 0 && (
                                    <div style={{ paddingLeft: '28px', marginBottom: '8px' }}>
                                        {roomDetails[ch.id].map(uid => {
                                            const member = serverMembers.find(m => m.username === uid || m.id === uid || m.uuid === uid);
                                            const displayName = member ? (member.display_name || member.username) : uid;
                                            const isCurrentUser = authState.user && (uid === authState.user.username || uid === authState.user.uuid);

                                            return (
                                                <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                    <div style={{
                                                        width: '14px',
                                                        height: '14px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#555',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '8px',
                                                        color: 'white',
                                                        border: speakingUsers.has(uid) ? '2px solid #34C759' : '2px solid transparent',
                                                        boxShadow: speakingUsers.has(uid) ? '0 0 8px #34C759' : 'none',
                                                        transition: 'all 0.2s ease'
                                                    }}>
                                                        {displayName.slice(0, 1).toUpperCase()}
                                                    </div>
                                                    <div
                                                        onContextMenu={(e) => {
                                                            if (handleUserContextMenu) {
                                                                handleUserContextMenu(e, member || { username: uid }); // Fallback to minimal user obj
                                                            }
                                                        }}
                                                        style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }}
                                                    >
                                                        <span style={{ fontSize: '11px', color: colors?.textMuted || '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={displayName}>
                                                            {displayName}
                                                        </span>
                                                    </div>
                                                    {/* Show mute/deafen icons for all users */}
                                                    {(() => {
                                                        const userVoiceState = isCurrentUser ? { isMuted, isDeafened, isScreenSharing } : (voiceStates[uid] || {});
                                                        return (userVoiceState.isMuted || userVoiceState.isDeafened || userVoiceState.isScreenSharing) && (
                                                            <div style={{ display: 'flex', gap: '2px', marginLeft: '2px' }}>
                                                                {userVoiceState.isScreenSharing && <span style={{ fontSize: '10px' }} title="Yayında">📺</span>}
                                                                {userVoiceState.isMuted && <span style={{ fontSize: '10px', filter: 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' }} title="Muted">🎙️</span>}
                                                                {userVoiceState.isDeafened && <span style={{ fontSize: '10px', filter: 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' }} title="Deafened">🎧</span>}
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div style={{ flexGrow: 1, padding: '20px', color: colors?.textMuted || '#666', textAlign: 'center', marginTop: '50px' }}>
                    <p>Bir sunucu seçin veya oluşturun.</p>
                </div>
            )
            }

            <UserFooter
                authState={authState}
                activeVoiceChannel={activeVoiceChannel}
                selectedServer={selectedServer}
                isMuted={isMuted}
                isDeafened={isDeafened}
                isNoiseCancelled={isNoiseCancelled}
                isScreenSharing={isScreenSharing}
                ping={ping}
                onDisconnect={onDisconnect}
                onToggleMute={onToggleMute}
                onToggleDeafen={onToggleDeafen}
                onToggleNoiseCancellation={onToggleNoiseCancellation}
                onScreenShare={onScreenShare}
                stopScreenShare={stopScreenShare}
                onStatusChange={onStatusChange}
                colors={colors}
            />

            {children}
        </div >
    );
};

export default ChannelList;
