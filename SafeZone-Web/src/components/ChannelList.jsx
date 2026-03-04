import React from 'react';
import UserFooter from './UserFooter';
import { PERMISSIONS, hasPermission } from '../utils/permissions';
import toast from '../utils/toast';

// Collapsible category section for channels
const CategorySection = ({ label, channels, colors, unreadChannels, renderChannelItem }) => {
    const [collapsed, setCollapsed] = React.useState(false);
    const hasUnread = channels.some(ch => unreadChannels?.has(ch.id));

    return (
        <div style={{ marginBottom: '4px' }}>
            {/* Category Header */}
            <div
                onClick={() => setCollapsed(c => !c)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '12px 4px 4px 4px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: colors?.textMuted || '#888',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                }}
                onMouseEnter={e => e.currentTarget.style.color = colors?.text || '#ccc'}
                onMouseLeave={e => e.currentTarget.style.color = colors?.textMuted || '#888'}
            >
                {/* Chevron */}
                <span style={{
                    display: 'inline-block',
                    fontSize: '9px',
                    transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                    transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    marginRight: '2px',
                    lineHeight: 1,
                }}>▾</span>
                <span style={{ flex: 1 }}>{label}</span>
                {/* Unread dot when collapsed */}
                {collapsed && hasUnread && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ED4245', display: 'inline-block', flexShrink: 0 }} />
                )}
            </div>
            {/* Channels */}
            <div style={{
                overflow: 'hidden',
                maxHeight: collapsed ? '0px' : '9999px',
                transition: 'max-height 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}>
                {channels.map(ch => renderChannelItem(ch))}
            </div>
        </div>
    );
};


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
                            {hasPermission(selectedServer.my_permissions, PERMISSIONS.MANAGE_SERVER) && (
                                <button
                                    onClick={handleServerSettings}
                                    title="Sunucu Ayarları (Roller)"
                                    style={{ background: 'none', border: 'none', color: colors?.textMuted || '#b9bbbe', fontSize: '16px', cursor: 'pointer', padding: '5px' }}
                                >
                                    ⚙️
                                </button>
                            )}
                            {hasPermission(selectedServer.my_permissions, PERMISSIONS.MANAGE_CHANNELS) && (
                                <button
                                    onClick={() => setShowChannelCreateModal(true)}
                                    title="Kanal Ekle"
                                    style={{ background: 'none', border: 'none', color: '#34C759', fontSize: '20px', cursor: 'pointer', padding: '5px' }}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ flexGrow: 1, padding: '8px', overflowY: 'auto' }}>
                        {(() => {
                            const textChannels = selectedServer.channels?.filter(ch => ch.type !== 'voice' && (selectedServer.my_permissions === undefined || hasPermission(selectedServer.my_permissions, PERMISSIONS.VIEW_CHANNELS))) || [];
                            const voiceChannels = selectedServer.channels?.filter(ch => ch.type === 'voice' && (selectedServer.my_permissions === undefined || hasPermission(selectedServer.my_permissions, PERMISSIONS.VIEW_CHANNELS))) || [];

                            const renderChannelItem = (ch) => {
                                const isActive = selectedChannel?.id === ch.id;
                                const isVoiceActive = activeVoiceChannel?.id === ch.id;
                                const hasUnread = unreadChannels?.has(ch.id);
                                const unreadCount = typeof unreadChannels?.get === 'function' ? unreadChannels.get(ch.id) : 1;

                                return (
                                    <div key={ch.id}>
                                        <div
                                            onClick={() => {
                                                if (ch.type === 'voice') {
                                                    const canConnect = selectedServer.my_permissions !== undefined ? hasPermission(selectedServer.my_permissions, PERMISSIONS.CONNECT) : true;
                                                    if (!canConnect) { alert("Ses odasına bağlanma yetkiniz yok."); return; }
                                                }
                                                handleChannelClick(ch);
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setContextMenu({ x: e.clientX, y: e.clientY, channelId: ch.id, channel: ch });
                                            }}
                                            style={{
                                                padding: '6px 10px',
                                                marginBottom: '1px',
                                                borderRadius: '6px',
                                                backgroundColor: isActive ? (colors?.cardHover || 'rgba(255,255,255,0.1)') : 'transparent',
                                                color: isActive ? (colors?.text || '#fff') : isVoiceActive ? '#34C759' : (colors?.textMuted || '#888'),
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                overflow: 'hidden',
                                                transition: 'background 0.12s, color 0.12s',
                                                fontWeight: hasUnread ? 700 : isActive ? 600 : 400,
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = colors?.cardHover || 'rgba(255,255,255,0.06)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ flexShrink: 0, opacity: isActive || isVoiceActive ? 1 : 0.7 }}>{ch.type === 'voice' ? '🔊' : '#'}</span>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontSize: '14px', color: hasUnread ? (colors?.text || '#fff') : 'inherit' }}>{ch.name}</span>
                                            {hasUnread && (
                                                <div style={{ minWidth: '18px', height: '18px', borderRadius: '9px', backgroundColor: '#ED4245', color: '#fff', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </div>
                                            )}
                                        </div>
                                        {/* ACTIVE VOICE USERS */}
                                        {ch.type === 'voice' && roomDetails[ch.id] && roomDetails[ch.id].length > 0 && (
                                            <div style={{ paddingLeft: '28px', marginBottom: '4px' }}>
                                                {roomDetails[ch.id].map(uid => {
                                                    const member = serverMembers.find(m => m.username === uid || m.id === uid || m.uuid === uid);
                                                    const displayName = member ? (member.display_name || member.username) : uid;
                                                    const isCurrentUser = authState.user && (uid === authState.user.username || uid === authState.user.uuid);
                                                    return (
                                                        <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'white', border: speakingUsers.has(uid) ? '2px solid #34C759' : '2px solid transparent', boxShadow: speakingUsers.has(uid) ? '0 0 8px #34C759' : 'none', transition: 'all 0.2s ease' }}>
                                                                {displayName.slice(0, 1).toUpperCase()}
                                                            </div>
                                                            <div onContextMenu={(e) => { if (handleUserContextMenu) handleUserContextMenu(e, member || { username: uid }); }} style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }}>
                                                                <span style={{ fontSize: '11px', color: colors?.textMuted || '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={displayName}>{displayName}</span>
                                                            </div>
                                                            {(() => {
                                                                const userVoiceState = isCurrentUser ? { isMuted, isDeafened, isScreenSharing } : (voiceStates[uid] || {});
                                                                return (userVoiceState.isMuted || userVoiceState.isDeafened || userVoiceState.isScreenSharing) && (
                                                                    <div style={{ display: 'flex', gap: '2px', marginLeft: '2px' }}>
                                                                        {userVoiceState.isScreenSharing && <span style={{ fontSize: '10px' }} title="Yayında">📺</span>}
                                                                        {userVoiceState.isMuted && <span style={{ fontSize: '10px', opacity: 0.6 }} title="Muted">🔇</span>}
                                                                        {userVoiceState.isDeafened && <span style={{ fontSize: '10px', opacity: 0.6 }} title="Deafened">🔕</span>}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            return (
                                <>
                                    {/* TEXT CHANNELS CATEGORY */}
                                    {textChannels.length > 0 && (
                                        <CategorySection
                                            label="METİN KANALLARI"
                                            channels={textChannels}
                                            colors={colors}
                                            unreadChannels={unreadChannels}
                                            renderChannelItem={renderChannelItem}
                                        />
                                    )}
                                    {/* VOICE CHANNELS CATEGORY */}
                                    {voiceChannels.length > 0 && (
                                        <CategorySection
                                            label="SES KANALLARI"
                                            channels={voiceChannels}
                                            colors={colors}
                                            unreadChannels={unreadChannels}
                                            renderChannelItem={renderChannelItem}
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </div>

                </>
            ) : (
                <div style={{ flexGrow: 1, padding: '20px', color: colors?.textMuted || '#666', textAlign: 'center', marginTop: '50px' }}>
                    <p>Bir sunucu seçin veya oluşturun.</p>
                </div>
            )
            }

            <UserFooter
                myPermissions={selectedServer?.my_permissions}
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
