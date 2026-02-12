import React, { useMemo } from 'react';
import { getUrl } from '../utils/api';

const MemberList = ({ members, onlineUserIds, userStatuses, colors, width, onResizeStart, handleUserContextMenu }) => {

    // Group members: Online, Offline
    const groupedMembers = useMemo(() => {
        const online = [];
        const offline = [];

        members.forEach(member => {
            const isOnline = onlineUserIds.includes(member.username);
            if (isOnline) {
                online.push(member);
            } else {
                offline.push(member);
            }
        });

        // Sort: Status priority (Online > Idle > DND > Invisible) ? No just alphabetical within groups for now
        // Maybe sort online by status priority?
        // Let's just sort alphabetically for now.
        online.sort((a, b) => a.username.localeCompare(b.username));
        offline.sort((a, b) => a.username.localeCompare(b.username));

        return { online, offline };
    }, [members, onlineUserIds]);

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
                {/* ONLINE SECTION */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: colors.textMuted,
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                    }}>
                        Çevrim İçi — {groupedMembers.online.length}
                    </div>
                    {groupedMembers.online.map(member => (
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
                                <div style={{ fontWeight: '500', color: colors.text }}>
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
                                <div style={{ fontWeight: '500', color: colors.text }}>
                                    {member.display_name || member.username}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MemberList;
