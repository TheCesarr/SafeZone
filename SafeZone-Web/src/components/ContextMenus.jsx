import React, { useState } from 'react';
import { PERMISSIONS, hasPermission } from '../utils/permissions';

export const ServerContextMenu = ({ contextMenu, onDelete, onLeave, onShare, isOwner }) => {
    if (!contextMenu || !contextMenu.serverId) return null;
    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, boxShadow: '0 5px 15px rgba(0,0,0,0.5)', minWidth: '150px' }}>
            <div onClick={() => onShare(contextMenu.serverId)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' } }}>
                🔗 Sunucuyu Paylaş
            </div>
            <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />
            {isOwner ? (
                <div onClick={() => onDelete(contextMenu.serverId)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#f04747', color: '#fff' } }}>
                    🗑️ Sunucuyu Sil
                </div>
            ) : (
                <div onClick={() => onLeave(contextMenu.serverId)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#f04747', color: '#fff' } }}>
                    🚪 Sunucudan Ayrıl
                </div>
            )}
        </div>
    );
};

export const ChannelContextMenu = ({ contextMenu, onDelete, onEdit, myPermissions }) => {
    if (!contextMenu || !contextMenu.channelId) return null;
    const canManageChannels = myPermissions ? hasPermission(myPermissions, PERMISSIONS.MANAGE_CHANNELS) : false;

    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, boxShadow: '0 5px 15px rgba(0,0,0,0.5)', minWidth: '150px' }}>
            {canManageChannels && (
                <>
                    <div onClick={() => onEdit(contextMenu.channelId, contextMenu.channel)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' } }}>
                        ✏️ Odayı Düzenle
                    </div>
                    <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />
                    <div onClick={() => onDelete(contextMenu.channelId)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#f04747', color: '#fff' } }}>
                        🗑️ Odayı Sil
                    </div>
                </>
            )}
        </div>
    );
};

export const UserContextMenu = ({ contextMenu, onAddFriend, onBlock, onCopyId, onMute, onVolumeChange, volume = 1, isMuted = false, myPermissions, onKick, onBan, onAssignRole, onUnassignRole, serverRoles }) => {
    const [showRoleSubmenu, setShowRoleSubmenu] = useState(false);
    if (!contextMenu) return null;

    const canKick = myPermissions ? hasPermission(myPermissions, PERMISSIONS.KICK_MEMBERS) : false;
    const canBan = myPermissions ? hasPermission(myPermissions, PERMISSIONS.BAN_MEMBERS) : false;
    const canManageRoles = myPermissions ? hasPermission(myPermissions, PERMISSIONS.MANAGE_ROLES) : false;
    const userRoles = contextMenu.user.roles || [];
    const hasRole = (roleId) => userRoles.some(r => r.id === roleId || r === roleId);

    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, minWidth: '180px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '8px 12px', color: '#fff', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #333', marginBottom: '5px' }}>
                {contextMenu.user.username}
            </div>

            {/* Added: Volume Controls for Voice Users */}
            {onMute && (
                <>
                    <div onClick={() => onMute(contextMenu.user.uuid || contextMenu.user.username)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Sessize Al</span>
                        <input type="checkbox" checked={isMuted} readOnly style={{ pointerEvents: 'none' }} />
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Kullanıcı Sesi</div>
                        <input
                            type="range"
                            min="0" max="200"
                            defaultValue={volume * 100}
                            onChange={(e) => onVolumeChange(contextMenu.user.uuid || contextMenu.user.username, e.target.value / 100)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', cursor: 'pointer', accentColor: '#3BA55C' }}
                        />
                    </div>
                    <div style={{ height: '1px', background: '#333', margin: '5px 0' }}></div>
                </>
            )}

            <div onClick={() => onAddFriend(contextMenu.user)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                Arkadaş Ekle
            </div>
            <div onClick={() => onCopyId(contextMenu.user.id || contextMenu.user.uuid)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                ID Kopyala
            </div>
            <div style={{ height: '1px', background: '#333', margin: '5px 0' }}></div>

            {canManageRoles && serverRoles && serverRoles.length > 0 && (
                <div
                    onMouseEnter={() => setShowRoleSubmenu(true)}
                    onMouseLeave={() => setShowRoleSubmenu(false)}
                    style={{ position: 'relative', padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' } }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Rol Ata</span>
                        <span style={{ fontSize: '10px' }}>▶</span>
                    </div>
                    {showRoleSubmenu && (
                        <div style={{ position: 'absolute', top: '-5px', left: '100%', background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', minWidth: '150px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', zIndex: 20001, marginLeft: '2px' }}>
                            {serverRoles.map(role => {
                                const isAssigned = hasRole(role.id);
                                return (
                                    <div
                                        key={role.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isAssigned) onUnassignRole(contextMenu.user, role.id);
                                            else onAssignRole(contextMenu.user, role.id);
                                        }}
                                        style={{ padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '2px', ':hover': { background: '#40444b' } }}
                                    >
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: role.color }}></div>
                                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{role.name}</span>
                                        {isAssigned && <span style={{ color: '#3ba55c', fontWeight: 'bold' }}>✓</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {canKick && onKick && (
                <div onClick={() => onKick(contextMenu.user)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px' }}>
                    👢 Sunucudan At
                </div>
            )}
            {canBan && onBan && (
                <div onClick={() => onBan(contextMenu.user)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px' }}>
                    🔨 Sunucudan Yasakla
                </div>
            )}
            <div onClick={() => onBlock(contextMenu.user)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px' }}>
                Engelle
            </div>
        </div>
    );
};

export const MessageContextMenu = ({ contextMenu, onDelete, onEdit, onReply, onReactClick, myPermissions }) => {
    if (!contextMenu) return null;
    const isMe = contextMenu.msg.sender === contextMenu.currentUser?.username;
    const canManageMessages = myPermissions ? hasPermission(myPermissions, PERMISSIONS.MANAGE_MESSAGES) : false;
    // Allow edit if ME or SYSADMIN
    const canEdit = isMe || contextMenu.currentUser?.is_sysadmin;
    // Allow delete if ME or SYSADMIN or MANAGE_MESSAGES
    const canDelete = isMe || contextMenu.currentUser?.is_sysadmin || canManageMessages;

    return (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '5px', zIndex: 20000, minWidth: '120px' }}>
            {onReactClick && (
                <div onClick={(e) => { e.stopPropagation(); onReactClick(contextMenu); }} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' }, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>➕</span><span>Tepki Ekle</span>
                </div>
            )}
            <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />
            {onReply && (
                <div onClick={() => onReply(contextMenu.msg)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' } }}>
                    ↩️ Yanıtla
                </div>
            )}
            {canEdit && (
                <div onClick={() => onEdit(contextMenu.msg)} style={{ padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#40444b' } }}>
                    ✏️ Düzenle
                </div>
            )}
            <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />
            {canDelete && (
                <div onClick={() => onDelete(contextMenu.msg)} style={{ padding: '8px 12px', color: '#f04747', cursor: 'pointer', fontSize: '14px', borderRadius: '2px', ':hover': { background: '#f04747', color: '#fff' } }}>
                    🗑️ Sil
                </div>
            )}
            <div style={{ fontSize: '10px', color: '#555', padding: '4px 12px', borderTop: '1px solid #222', marginTop: '4px' }}>
                ID: {contextMenu.msg.id}
            </div>
        </div>
    );
};
