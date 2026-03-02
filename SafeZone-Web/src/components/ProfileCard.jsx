import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { getUrl } from '../utils/api';

const ProfileCard = ({ user, onClose, colors, serverRoles = [], rect, currentUser, selectedServer, authToken }) => {
    const cardRef = useRef(null);
    const [position, setPosition] = useState({ opacity: 0 }); // Hidden until measured

    // Use user.user_id if present (from /members API), fallback to user.id
    const userId = user?.user_id || user?.id;

    // Initialize assigned role IDs from user.roles array (can be IDs or objects)
    const [assignedRoleIds, setAssignedRoleIds] = useState(() => {
        if (!user?.roles) return [];
        return user.roles
            .map(r => (typeof r === 'object' ? (r.id ?? r.role_id) : r))
            .filter(Boolean);
    });
    const [roleLoading, setRoleLoading] = useState(null);

    const MANAGE_ROLES_PERM = 4;
    const canManageRoles = currentUser?.is_sysadmin ||
        selectedServer?.owner_id === (currentUser?.user_id || currentUser?.id) ||
        ((selectedServer?.my_permissions ?? 0) & MANAGE_ROLES_PERM) === MANAGE_ROLES_PERM;

    const toggleRole = useCallback(async (role) => {
        if (!authToken || !selectedServer || !userId) return;
        const hasRole = assignedRoleIds.includes(role.id);
        const action = hasRole ? 'unassign' : 'assign';
        setRoleLoading(role.id);
        try {
            const res = await fetch(getUrl(`/server/${selectedServer.id}/roles/${role.id}/${action}`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authToken, user_id: userId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setAssignedRoleIds(prev =>
                    hasRole ? prev.filter(id => id !== role.id) : [...prev, role.id]
                );
            }
        } catch (e) { console.error('Role toggle error:', e); }
        finally { setRoleLoading(null); }
    }, [assignedRoleIds, authToken, selectedServer, userId]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (cardRef.current && !cardRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Smart positioning: runs after every render so re-measures if content changes (e.g. role added)
    useLayoutEffect(() => {
        if (!cardRef.current) return;

        if (!rect) {
            setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 1 });
            return;
        }

        const cardH = cardRef.current.offsetHeight;
        const cardW = cardRef.current.offsetWidth || 300;
        const MARGIN = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Try right of the triggering element (Discord style)
        let leftPx = rect.right + MARGIN;
        let topPx = rect.top;

        // Flip left if overflows right edge
        if (leftPx + cardW > vw) {
            leftPx = rect.left - cardW - MARGIN;
        }

        // Shift up if overflows bottom edge
        if (topPx + cardH > vh) {
            topPx = vh - cardH - MARGIN;
        }

        // Hard clamp — never go off screen
        if (leftPx < MARGIN) leftPx = MARGIN;
        if (topPx < MARGIN) topPx = MARGIN;

        setPosition({ left: `${leftPx}px`, top: `${topPx}px`, opacity: 1, transform: 'none' });
    }); // intentionally no dep array — runs after every render to adapt to content size changes

    if (!user) return null;

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#3BA55C';
            case 'idle': return '#FAA61A';
            case 'dnd': return '#ED4245';
            default: return '#747F8D';
        }
    };

    const bgColor = colors?.card || '#18191c';
    const textColor = colors?.text || '#fff';
    const mutedColor = colors?.textMuted || '#b9bbbe';
    const accentColor = user.avatar_color || colors?.accent || '#5865F2';

    // Only show roles that are actually assigned to this user
    const assignedRoles = serverRoles.filter(r => assignedRoleIds.includes(r.id));
    // Unassigned roles — only managers see these as addable
    const unassignedRoles = serverRoles.filter(r => !assignedRoleIds.includes(r.id));

    return (
        <div
            ref={cardRef}
            style={{
                position: 'fixed',
                ...position,
                zIndex: 100000,
                width: '300px',
                backgroundColor: bgColor,
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                border: `1px solid ${colors?.border || 'rgba(255,255,255,0.05)'}`,
                animation: 'scaleIn 0.15s ease-out',
                transition: 'opacity 0.1s'
            }}
        >
            {/* Banner */}
            <div style={{ height: '60px', backgroundColor: accentColor, borderRadius: '8px 8px 0 0' }} />

            {/* Avatar + Info */}
            <div style={{ padding: '0 16px 16px 16px' }}>
                <div style={{ marginTop: '-40px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: bgColor, padding: '6px', position: 'relative', zIndex: 2 }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#36393f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', overflow: 'hidden', position: 'relative' }}>
                        {user.avatar_url ? (
                            <img src={getUrl(user.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
                        )}
                    </div>
                    <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: getStatusColor(user.status), border: `4px solid ${bgColor}` }} />
                </div>

                <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: textColor, wordBreak: 'break-all' }}>
                        {user.display_name || user.username}
                    </div>
                    <div style={{ fontSize: '14px', color: mutedColor }}>
                        {user.username}#{user.discriminator || '0001'}
                    </div>

                    {user.custom_status && (
                        <div style={{ marginTop: '12px', padding: '8px', fontSize: '13px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', color: textColor, fontStyle: 'italic', borderLeft: `2px solid ${accentColor}` }}>
                            {user.custom_status}
                        </div>
                    )}

                    <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />

                    {/* ── ROLLER ── */}
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Roller</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>

                        {/* SysAdmin badge always shown for admins */}
                        {user.is_sysadmin && (
                            <div style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(237,66,69,0.15)', border: '1px solid rgba(237,66,69,0.5)', color: '#ed4245', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ed4245', flexShrink: 0 }} />
                                ADMİN
                            </div>
                        )}

                        {/* Only show roles this user actually has */}
                        {assignedRoles.map(role => {
                            const isLoading = roleLoading === role.id;
                            const color = role.color || '#5865F2';
                            return (
                                <div
                                    key={role.id}
                                    onClick={() => canManageRoles && !isLoading && toggleRole(role)}
                                    title={canManageRoles ? `Rolü kaldır: ${role.name}` : role.name}
                                    style={{
                                        padding: '4px 8px', borderRadius: '4px',
                                        backgroundColor: `${color}22`,
                                        border: `1px solid ${color}60`,
                                        color: color,
                                        fontSize: '11px',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        cursor: canManageRoles ? 'pointer' : 'default',
                                        opacity: isLoading ? 0.5 : 1,
                                        transition: 'all 0.15s ease',
                                        userSelect: 'none',
                                        fontWeight: 500
                                    }}
                                    onMouseEnter={e => { if (canManageRoles) e.currentTarget.style.opacity = '0.7'; }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = isLoading ? '0.5' : '1'; }}
                                >
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                                    {isLoading ? '...' : role.name}
                                    {canManageRoles && !isLoading && <span style={{ opacity: 0.6, fontSize: '11px' }}>✕</span>}
                                </div>
                            );
                        })}

                        {/* Fallback when user has no roles */}
                        {!user.is_sysadmin && assignedRoles.length === 0 && (
                            <div style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: mutedColor, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: mutedColor, flexShrink: 0 }} />
                                Üye
                            </div>
                        )}
                    </div>

                    {/* Unassigned roles section — only for managers */}
                    {canManageRoles && unassignedRoles.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '10px', color: mutedColor, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol Ekle</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {unassignedRoles.map(role => {
                                    const isLoading = roleLoading === role.id;
                                    const color = role.color || '#5865F2';
                                    return (
                                        <div
                                            key={role.id}
                                            onClick={() => !isLoading && toggleRole(role)}
                                            title={`Rol ata: ${role.name}`}
                                            style={{
                                                padding: '3px 7px', borderRadius: '4px',
                                                backgroundColor: 'rgba(0,0,0,0.15)',
                                                border: '1px dashed rgba(255,255,255,0.2)',
                                                color: mutedColor,
                                                fontSize: '11px',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                cursor: 'pointer',
                                                opacity: isLoading ? 0.5 : 1,
                                                transition: 'all 0.15s ease',
                                                userSelect: 'none'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = mutedColor; }}
                                        >
                                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, opacity: 0.5, flexShrink: 0 }} />
                                            {isLoading ? '...' : role.name}
                                            <span style={{ opacity: 0.5, fontSize: '11px' }}>+</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileCard;
