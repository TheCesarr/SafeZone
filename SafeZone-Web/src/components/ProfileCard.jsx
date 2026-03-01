import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getUrl } from '../utils/api';

const ProfileCard = ({ user, onClose, colors, serverRoles = [], rect, currentUser, selectedServer, authToken }) => {
    const cardRef = useRef(null);
    const [position, setPosition] = useState({ opacity: 0 }); // Invisible strictly for measuring

    // Fix 5: Role assignment state
    const [assignedRoleIds, setAssignedRoleIds] = useState(() => {
        if (!user?.roles) return [];
        return user.roles.map(r => r.id ?? r.role_id).filter(Boolean);
    });
    const [roleLoading, setRoleLoading] = useState(null); // role_id being toggled

    const canManageRoles = currentUser?.is_sysadmin ||
        selectedServer?.owner_id === currentUser?.id ||
        currentUser?.permissions?.includes?.('MANAGE_ROLES');

    const toggleRole = useCallback(async (role) => {
        if (!authToken || !selectedServer || !user) return;
        const hasRole = assignedRoleIds.includes(role.id);
        const action = hasRole ? 'unassign' : 'assign';
        setRoleLoading(role.id);
        try {
            const res = await fetch(getUrl(`/server/${selectedServer.id}/roles/${role.id}/${action}`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authToken, user_id: user.id })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setAssignedRoleIds(prev =>
                    hasRole ? prev.filter(id => id !== role.id) : [...prev, role.id]
                );
            }
        } catch (e) { console.error('Role toggle error:', e); }
        finally { setRoleLoading(null); }
    }, [assignedRoleIds, authToken, selectedServer, user]);


    useEffect(() => {
        const handleClickOutside = (e) => {
            if (cardRef.current && !cardRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        if (!cardRef.current) return;

        // Failsafe center position if no rect is given
        if (!rect) {
            setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 1 });
            return;
        }

        const cardH = cardRef.current.offsetHeight || 350;
        const cardW = 300;
        const MARGIN = 15;

        // 1. Try Right Side
        let leftPx = rect.right + MARGIN;
        let topPx = rect.top;

        // 2. Collision Right -> Flip Left
        if (leftPx + cardW > window.innerWidth) {
            leftPx = rect.left - cardW - MARGIN;
        }

        // 3. Collision Bottom -> Shift Up
        if (topPx + cardH > window.innerHeight) {
            topPx = window.innerHeight - cardH - MARGIN;
        }

        // 4. Absolute Failsafes 
        if (leftPx < MARGIN) leftPx = MARGIN;
        if (topPx < MARGIN) topPx = MARGIN;

        setPosition({
            left: `${leftPx}px`,
            top: `${topPx}px`,
            opacity: 1,
            transform: 'none'
        });

    }, [rect]);

    if (!user) return null;

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#3BA55C';
            case 'idle': return '#FAA61A';
            case 'dnd': return '#ED4245';
            case 'invisible': return '#747F8D';
            default: return '#747F8D'; // offline
        }
    };

    const bgColor = colors?.card || '#18191c';
    const textColor = colors?.text || '#fff';
    const mutedColor = colors?.textMuted || '#b9bbbe';
    const accentColor = user.avatar_color || colors?.accent || '#5865F2';

    // Figure out user's role displays (if available from serverMembers list enrichment)
    const displayRoleColor = user.role_color || mutedColor;
    const displayRoleName = user.highest_role?.name || (user.is_sysadmin ? 'System Admin' : 'Member');

    return (
        <div style={{
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
        }} ref={cardRef}>

            {/* Banner */}
            <div style={{
                height: '60px',
                backgroundColor: accentColor,
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px'
            }}></div>

            {/* Avatar Profile */}
            <div style={{ padding: '0 16px 16px 16px' }}>
                <div style={{
                    marginTop: '-40px',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: bgColor,
                    padding: '6px',
                    position: 'relative',
                    zIndex: 2
                }}>
                    <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: '#36393f',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '28px', color: '#fff',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {user.avatar_url ? (
                            <img src={getUrl(user.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
                        )}
                    </div>
                    {/* Status Indicator over big avatar */}
                    <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(user.status),
                        border: `4px solid ${bgColor}`
                    }}></div>
                </div>

                {/* Info Area */}
                <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: textColor, wordBreak: 'break-all' }}>
                        {user.display_name || user.username}
                    </div>
                    <div style={{ fontSize: '14px', color: mutedColor }}>
                        {user.username}#{user.discriminator || '0001'}
                    </div>

                    {user.custom_status && (
                        <div style={{
                            marginTop: '12px',
                            padding: '8px',
                            fontSize: '13px',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: '4px',
                            color: textColor,
                            fontStyle: 'italic',
                            borderLeft: `2px solid ${accentColor}`
                        }}>
                            {user.custom_status}
                        </div>
                    )}

                    <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '12px 0' }}></div>

                    {/* Roles Section */}
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, marginBottom: '6px', textTransform: 'uppercase' }}>Roller</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {user.is_sysadmin && (
                            <div style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(237, 66, 69, 0.1)', border: '1px solid rgba(237, 66, 69, 0.3)', color: '#ed4245', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ed4245' }}></span>
                                SysAdmin
                            </div>
                        )}
                        {serverRoles.length > 0 ? serverRoles.map(role => {
                            const isAssigned = assignedRoleIds.includes(role.id);
                            const isLoading = roleLoading === role.id;
                            const color = role.color || '#5865F2';
                            return (
                                <div
                                    key={role.id}
                                    onClick={() => canManageRoles && !isLoading && toggleRole(role)}
                                    title={canManageRoles ? (isAssigned ? `Rolü Kaldır: ${role.name}` : `Rolü Ata: ${role.name}`) : role.name}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: isAssigned ? `${color}22` : 'rgba(0,0,0,0.15)',
                                        border: `1px solid ${isAssigned ? color + '60' : 'rgba(255,255,255,0.1)'}`,
                                        color: isAssigned ? color : mutedColor,
                                        fontSize: '11px',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        cursor: canManageRoles ? 'pointer' : 'default',
                                        opacity: isLoading ? 0.5 : 1,
                                        transition: 'all 0.15s ease',
                                        userSelect: 'none',
                                    }}
                                    onMouseEnter={e => { if (canManageRoles) e.currentTarget.style.filter = 'brightness(1.3)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                                >
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isAssigned ? color : 'rgba(255,255,255,0.2)', flexShrink: 0 }}></span>
                                    {isLoading ? '...' : role.name}
                                    {canManageRoles && !isLoading && (
                                        <span style={{ opacity: 0.5, fontSize: '10px', marginLeft: '2px' }}>
                                            {isAssigned ? '✕' : '+'}
                                        </span>
                                    )}
                                </div>
                            );
                        }) : (
                            <div style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${displayRoleColor}40`, color: textColor, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: displayRoleColor }}></span>
                                {displayRoleName}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ProfileCard;
