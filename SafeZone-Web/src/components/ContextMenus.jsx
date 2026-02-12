import React from 'react';

export const ServerContextMenu = ({ contextMenu, onDelete }) => {
    if (!contextMenu) return null;
    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
            <div onClick={() => onDelete(contextMenu.serverId)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#f04747', color: '#fff' } }}>
                Sunucuyu Sil / Ayrıl
            </div>
        </div>
    );
};

export const UserContextMenu = ({ contextMenu, onAddFriend, onBlock, onCopyId }) => {
    if (!contextMenu) return null;
    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, minWidth: '150px' }}>
            <div style={{ padding: '8px 12px', color: '#fff', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #333', marginBottom: '5px' }}>
                {contextMenu.user.username}
            </div>
            <div onClick={() => onAddFriend(contextMenu.user)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                Arkadaş Ekle
            </div>
            <div onClick={() => onCopyId(contextMenu.user.id || contextMenu.user.uuid)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                ID Kopyala
            </div>
            <div style={{ height: '1px', background: '#333', margin: '5px 0' }}></div>
            <div onClick={() => onBlock(contextMenu.user)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px' }}>
                Engelle
            </div>
        </div>
    );
};

export const MessageContextMenu = ({ contextMenu, onDelete, onEdit }) => {
    if (!contextMenu) return null;
    const isMe = contextMenu.msg.sender === contextMenu.currentUser?.username;
    // Allow if ME or SYSADMIN
    const canEdit = isMe || contextMenu.currentUser?.is_sysadmin;

    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, minWidth: '120px' }}>
            {canEdit && (
                <div onClick={() => onEdit(contextMenu.msg)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' } }}>
                    ✏️ Düzenle
                </div>
            )}
            <div onClick={() => onDelete(contextMenu.msg)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#f04747', color: '#fff' } }}>
                🗑️ Sil
            </div>
            <div style={{ fontSize: '10px', color: '#555', padding: '4px 12px', borderTop: '1px solid #222', marginTop: '4px' }}>
                ID: {contextMenu.msg.id}
            </div>
        </div>
    );
};
