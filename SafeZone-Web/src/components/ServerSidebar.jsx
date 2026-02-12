import React from 'react';
import ServerIcon from './ServerIcon';

const ServerSidebar = ({
    myServers,
    selectedServer,
    showFriendsList,
    onServerClick,
    onFriendsClick,
    onCreateServerClick,
    onJoinServerClick,
    onSettingsClick,
    handleServerRightClick,
    colors,
    unreadChannels,
    unreadDMs,
    friendRequestsCount,
    isSysAdmin,
    onAdminClick
}) => {
    // Dynamic Styles
    const sidebarBg = colors?.sidebar || 'rgba(10, 10, 15, 0.6)';
    const borderColor = colors?.border || 'rgba(255, 255, 255, 0.1)';
    const buttonBg = colors?.card || '#222'; // Use card color for generic buttons
    const muteColor = colors?.textMuted || '#b9bbbe';

    return (
        <div style={{ width: '72px', flexShrink: 0, background: sidebarBg, backdropFilter: 'blur(20px) saturate(180%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px 0', gap: '15px', borderRight: `1px solid ${borderColor}`, order: 1, zIndex: 10 }}>
            {/* Friends Button */}
            <div
                title="Arkadaşlar"
                onClick={onFriendsClick}
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: showFriendsList ? '16px' : '50%',
                    background: showFriendsList ? 'linear-gradient(135deg, #5865F2, #707cf5)' : (colors?.card || 'rgba(255, 255, 255, 0.05)'),
                    backdropFilter: 'blur(10px)',
                    border: showFriendsList ? '1px solid rgba(255, 255, 255, 0.2)' : `1px solid ${borderColor}`,
                    boxShadow: showFriendsList ? '0 8px 32px 0 rgba(88, 101, 242, 0.37)' : 'none',
                    color: showFriendsList ? '#fff' : (colors?.text || '#fff'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                👥
                {/* Friend Requests Badge */}
                {friendRequestsCount > 0 && <div style={{ position: 'absolute', bottom: -2, right: -2, minWidth: '16px', height: '16px', borderRadius: '8px', backgroundColor: '#ED4245', border: '2px solid #202225', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', padding: '0 2px' }}>{friendRequestsCount}</div>}

                {/* Unread DMs Badge (if no pending requests but unread DMs exist) */}
                {friendRequestsCount === 0 && unreadDMs?.size > 0 && <div style={{ position: 'absolute', bottom: -2, right: -2, width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fff', border: '2px solid #202225' }}></div>}
            </div>

            <div style={{ width: '48px', height: '2px', backgroundColor: borderColor }} />

            {/* Admin Panel Button */}
            {isSysAdmin && (
                <>
                    <div
                        title="Admin Paneli"
                        onClick={onAdminClick}
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: '#ed4245',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '20px',
                            border: `1px solid ${borderColor}`,
                            marginBottom: '10px'
                        }}
                    >
                        🛡️
                    </div>
                    <div style={{ width: '48px', height: '2px', backgroundColor: borderColor }} />
                </>
            )}

            {myServers.map(s => {
                const hasUnread = s.channels?.some(ch => unreadChannels?.has(ch.id));
                return (
                    <ServerIcon
                        key={s.id}
                        server={s}
                        selected={selectedServer?.id === s.id}
                        onClick={() => onServerClick(s)}
                        onContextMenu={(e) => handleServerRightClick(e, s)}
                        hasUnread={hasUnread}
                    />
                );
            })}
            <div style={{ width: '48px', height: '2px', backgroundColor: borderColor }} />
            <div title="Sunucu Oluştur" onClick={onCreateServerClick} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: buttonBg, color: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', border: `1px solid ${borderColor}` }}>+</div>
            <div title="Sunucuya Katıl" onClick={onJoinServerClick} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: buttonBg, color: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px', border: `1px solid ${borderColor}` }}>🔗</div>

            {/* Settings Button */}
            <div
                title="Ayarlar"
                onClick={onSettingsClick}
                style={{
                    marginTop: 'auto',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: buttonBg,
                    color: muteColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    marginBottom: '10px',
                    transition: 'all 0.2s',
                    border: `1px solid ${borderColor}`
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors?.accent || '#333'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = buttonBg; e.currentTarget.style.color = muteColor; }}
            >
                ⚙️
            </div>
        </div>
    );
};

export default ServerSidebar;
