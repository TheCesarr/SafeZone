import React from 'react';
import { getUrl } from '../utils/api';

// Curated palette of vibrant, harmonious colors for server icons
const SERVER_COLORS = [
    '#5865F2', // Discord blue
    '#EB459E', // Pink
    '#57F287', // Green
    '#FEE75C', // Yellow (text shadow helps)
    '#ED4245', // Red
    '#3BA55C', // Dark green
    '#FAA61A', // Orange
    '#9B59B6', // Purple
    '#1ABC9C', // Teal
    '#E67E22', // Warm orange
    '#2980B9', // Ocean blue
    '#E74C3C', // Crimson
];

const getServerColor = (serverId) => {
    if (!serverId) return SERVER_COLORS[0];
    const hash = String(serverId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return SERVER_COLORS[hash % SERVER_COLORS.length];
};

const ServerIcon = ({ server, selected, onClick, onContextMenu, hasUnread }) => {
    const [hovered, setHovered] = React.useState(false);
    const memberCount = server.member_count ?? server.members?.length ?? server.channels?.length ?? null;
    const iconColor = getServerColor(server.id);

    return (
        <div style={{ position: 'relative', marginBottom: '10px' }}>
            {/* Rich Tooltip */}
            {hovered && (
                <div style={{
                    position: 'absolute',
                    left: '58px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(18, 18, 24, 0.97)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    zIndex: 99999,
                    minWidth: '140px',
                    maxWidth: '220px',
                    pointerEvents: 'none',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    animation: 'szTooltipIn 0.12s ease',
                    whiteSpace: 'nowrap',
                }}>
                    <style>{`@keyframes szTooltipIn { from { opacity:0; transform: translateY(-50%) translateX(-6px); } to { opacity:1; transform: translateY(-50%) translateX(0); } }`}</style>
                    {/* Arrow */}
                    <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: '6px solid rgba(18,18,24,0.97)' }} />
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff', marginBottom: memberCount !== null ? '4px' : 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{server.name}</div>
                    {memberCount !== null && <div style={{ fontSize: '11px', color: '#888' }}>👥 {memberCount} üye</div>}
                </div>
            )}

            <div
                onClick={onClick}
                onContextMenu={onContextMenu}
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: selected ? '16px' : '50%',
                    backgroundColor: selected ? '#5865F2' : iconColor,
                    backgroundImage: server.icon ? `url(${getUrl(server.icon)})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontSize: server.icon ? '0' : '18px',
                    fontWeight: 'bold',
                    position: 'relative',
                    boxShadow: selected ? '0 0 0 2px rgba(88,101,242,0.4)' : hovered ? `0 4px 16px ${iconColor}66` : 'none',
                    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
                onMouseEnter={(e) => {
                    setHovered(true);
                    if (!selected) {
                        e.currentTarget.style.borderRadius = '16px';
                        e.currentTarget.style.backgroundColor = '#5865F2';
                    }
                }}
                onMouseLeave={(e) => {
                    setHovered(false);
                    if (!selected) {
                        e.currentTarget.style.borderRadius = '50%';
                        e.currentTarget.style.backgroundColor = iconColor;
                    }
                }}
            >
                {!server.icon && server.name.slice(0, 2).toUpperCase()}
                {hasUnread && <div style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ED4245', border: '3px solid #202225' }}></div>}
                {selected && <div style={{ position: 'absolute', left: '-13px', width: '8px', height: '40px', borderRadius: '0 4px 4px 0', backgroundColor: '#fff' }}></div>}
            </div>
        </div>
    );
};

export default ServerIcon;

