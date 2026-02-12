import React from 'react';
import { getUrl } from '../utils/api';

const ServerIcon = ({ server, selected, onClick, onContextMenu, hasUnread }) => (
    <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        title={server.name}
        style={{
            width: '48px',
            height: '48px',
            borderRadius: selected ? '16px' : '50%',
            backgroundColor: selected ? '#5865F2' : '#333',
            backgroundImage: server.icon ? `url(${getUrl(server.icon)})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginBottom: '10px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontSize: server.icon ? '0' : '18px',
            fontWeight: 'bold',
            position: 'relative'
        }}
        onMouseEnter={(e) => {
            if (!selected) {
                e.currentTarget.style.borderRadius = '16px';
                e.currentTarget.style.backgroundColor = '#5865F2';
            }
        }}
        onMouseLeave={(e) => {
            if (!selected) {
                e.currentTarget.style.borderRadius = '50%';
                e.currentTarget.style.backgroundColor = '#333';
            }
        }}
    >
        {!server.icon && server.name.slice(0, 2).toUpperCase()}
        {hasUnread && <div style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ED4245', border: '3px solid #202225' }}></div>}
        {selected && <div style={{ position: 'absolute', left: '-13px', width: '8px', height: '40px', borderRadius: '0 4px 4px 0', backgroundColor: '#fff' }}></div>}
    </div>
);

export default ServerIcon;
