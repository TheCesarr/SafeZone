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
    handleServerRightClick
}) => {
    return (
        <div style={{ width: '72px', flexShrink: 0, background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(20px) saturate(180%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px 0', gap: '15px', borderRight: '1px solid rgba(255, 255, 255, 0.1)', order: 1 }}>
            {/* Friends Button */}
            <div
                title="Arkadaşlar"
                onClick={onFriendsClick}
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: showFriendsList ? '16px' : '50%',
                    background: showFriendsList ? 'linear-gradient(135deg, #5865F2, #707cf5)' : 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: showFriendsList ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: showFriendsList ? '0 8px 32px 0 rgba(88, 101, 242, 0.37)' : 'none',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                👥
            </div>

            <div style={{ width: '48px', height: '2px', backgroundColor: '#333' }} />

            {myServers.map(s => (
                <ServerIcon
                    key={s.id}
                    server={s}
                    selected={selectedServer?.id === s.id}
                    onClick={() => onServerClick(s)}
                    onContextMenu={(e) => handleServerRightClick(e, s)}
                />
            ))}
            <div style={{ width: '48px', height: '2px', backgroundColor: '#333' }} />
            <div title="Sunucu Oluştur" onClick={onCreateServerClick} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#333', color: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px' }}>+</div>
            <div title="Sunucuya Katıl" onClick={onJoinServerClick} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#333', color: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px' }}>🔗</div>

            {/* Settings Button */}
            <div
                title="Ayarlar"
                onClick={onSettingsClick}
                style={{
                    marginTop: 'auto',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#222',
                    color: '#b9bbbe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    marginBottom: '10px',
                    transition: 'all 0.2s',
                    border: '1px solid #333'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#333'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#222'; e.currentTarget.style.color = '#b9bbbe'; }}
            >
                ⚙️
            </div>
        </div>
    );
};

export default ServerSidebar;
