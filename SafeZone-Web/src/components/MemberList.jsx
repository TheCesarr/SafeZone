import React, { useMemo, useState } from 'react';
import { getUrl } from '../utils/api';
import ProfileCard from './ProfileCard';

const MemberList = ({ members, onlineUserIds, userStatuses, colors, width, onResizeStart, handleUserContextMenu, serverRoles = [], currentUser, selectedServer, authToken }) => {
    const [selectedUserForProfile, setSelectedUserForProfile] = useState(null);

    // Group members: Online by highest_role, Offline
    const groupedMembers = useMemo(() => {
        const groups = {};
        const offline = [];

        members.forEach(member => {
            const isOnline = onlineUserIds.includes(member.username);
            if (isOnline) {
                const roleName = member.highest_role?.name || 'Çevrim İçi';
                if (!groups[roleName]) {
                    groups[roleName] = {
                        name: roleName,
                        color: member.highest_role?.color || colors.textMuted,
                        position: member.highest_role?.position || 0,
                        members: []
                    };
                }
                groups[roleName].members.push(member);
            } else {
                offline.push(member);
            }
        });

        const onlineGroups = Object.values(groups).sort((a, b) => {
            if (a.name === 'Çevrim İçi') return 1;
            if (b.name === 'Çevrim İçi') return -1;
            return b.position - a.position;
        });

        onlineGroups.forEach(g => g.members.sort((a, b) => a.username.localeCompare(b.username)));
        offline.sort((a, b) => a.username.localeCompare(b.username));

        return { onlineGroups, offline };
    }, [members, onlineUserIds, colors]);

    const getStatusColor = (username) => {
        const status = userStatuses?.[username] || 'online';
        switch (status) {
            case 'idle': return '#FAA61A';
            case 'dnd': return '#ED4245';
            case 'invisible': return '#747F8D';
            default: return '#34C759';
        }
    };

    return (
        <div style={{
            width: width,
            minWidth: '180px',
            maxWidth: '400px',
            background: colors.secondary, // Slightly darker than main chat
            display: 'flex',
            flexDirection: 'column',
            borderLeft: `1px solid ${colors.border}`,
            position: 'relative',
            height: '100%'
        }}>
            {/* Resize Handle */}
            <div
                onMouseDown={(e) => onResizeStart(e, 'member')}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: -4,
                    width: '6px',
                    height: '100%',
                    cursor: 'ew-resize',
                    zIndex: 10
                }}
            />

            <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                {/* ONLINE SECTIONS BY ROLE */}
                {groupedMembers.onlineGroups.map(group => (
                    <div key={group.name} style={{ marginBottom: '24px' }}>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: colors.textMuted,
                            marginBottom: '8px',
                            textTransform: 'uppercase'
                        }}>
                            {group.name} — {group.members.length}
                        </div>
                        {group.members.map(member => (
                            <div key={member.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px 8px',
                                marginBottom: '4px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                opacity: 1
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.cardHover}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                onContextMenu={(e) => handleUserContextMenu(e, member)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUserForProfile({
                                        user: member,
                                        rect: e.currentTarget.getBoundingClientRect()
                                    });
                                }}
                            >
                                <div style={{ position: 'relative', marginRight: '10px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: member.avatar_color || '#5865F2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        fontSize: '14px'
                                    }}>
                                        {member.avatar_url ? (
                                            <img src={getUrl(member.avatar_url)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            member.username.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: getStatusColor(member.username),
                                        position: 'absolute',
                                        bottom: '-2px',
                                        right: '-2px',
                                        border: `3px solid ${colors.secondary}` // Match background to create "cutout" effect
                                    }}></div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: '500', color: member.role_color || colors.text, transition: 'color 0.2s' }}>
                                        {member.display_name || member.username}
                                    </div>
                                    {member.display_name && (
                                        <div style={{ fontSize: '11px', color: colors.textMuted }}>
                                            {member.username}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {/* OFFLINE SECTION */}
                <div>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: colors.textMuted,
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                    }}>
                        Çevrim Dışı — {groupedMembers.offline.length}
                    </div>
                    {groupedMembers.offline.map(member => (
                        <div key={member.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px 8px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: 0.5 // Faded for offline
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.cardHover; e.currentTarget.style.opacity = 0.8; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = 0.5; }}
                            onContextMenu={(e) => handleUserContextMenu(e, member)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForProfile({
                                    user: member,
                                    rect: e.currentTarget.getBoundingClientRect()
                                });
                            }}
                        >
                            <div style={{ marginRight: '10px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: member.avatar_color || '#5865F2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    filter: 'grayscale(100%)' // Grayscale for offline
                                }}>
                                    {member.avatar_url ? (
                                        <img src={getUrl(member.avatar_url)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        member.username.substring(0, 2).toUpperCase()
                                    )}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontWeight: '500', color: member.role_color || colors.text, transition: 'color 0.2s' }}>
                                    {member.display_name || member.username}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Profile Card Modal Overlay */}
            {selectedUserForProfile && (
                <ProfileCard
                    user={selectedUserForProfile.user}
                    rect={selectedUserForProfile.rect}
                    colors={colors}
                    serverRoles={serverRoles}
                    currentUser={currentUser}
                    selectedServer={selectedServer}
                    authToken={authToken}
                    onClose={() => setSelectedUserForProfile(null)}
                />
            )}
        </div>
    );
};

export default MemberList;
