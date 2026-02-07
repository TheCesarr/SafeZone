import React, { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';

const ServerSettings = ({ server, onClose, authState, colors }) => {
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'roles'
    // Server Edit State
    const [serverName, setServerName] = useState(server.name);

    // Roles State
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [editRoleName, setEditRoleName] = useState("");
    const [editRoleColor, setEditRoleColor] = useState("#99AAB5");
    const [editPermissions, setEditPermissions] = useState(0);

    useEffect(() => {
        if (activeTab === 'roles') {
            fetchRoles();
        }
    }, [activeTab, server.id]);

    // --- OVERVIEW ACTIONS ---
    const handleSaveOverview = async () => {
        // Mock implementation for server name update
        alert("Sunucu adı güncelleme henüz aktif değil, ama buraya gelecek!");
    }

    // --- ROLES ACTIONS ---
    const fetchRoles = async (targetRoleId = null) => {
        try {
            const res = await fetch(getUrl(`/server/${server.id}/roles`));
            const data = await res.json();
            if (data.status === 'success') {
                const sorted = data.roles.sort((a, b) => b.position - a.position);
                setRoles(sorted);
                if (targetRoleId) {
                    const target = sorted.find(r => r.id === targetRoleId);
                    if (target) selectRole(target);
                } else if (!selectedRole && sorted.length > 0) {
                    selectRole(sorted[0]);
                }
            }
        } catch (e) { console.error(e); }
    };

    const selectRole = (role) => {
        setSelectedRole(role);
        setEditRoleName(role.name);
        setEditRoleColor(role.color);
        setEditPermissions(role.permissions);
    };

    const handleCreateRole = async () => {
        try {
            const res = await fetch(getUrl(`/server/${server.id}/roles`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, name: "yeni rol", color: "#99AAB5", permissions: 0 })
            });
            const data = await res.json();
            if (data.status === 'success') fetchRoles(data.role ? data.role.id : null);
            else alert(data.message);
        } catch (e) { alert(e.message); }
    };

    const handleSaveRole = async () => {
        if (!selectedRole) return;
        try {
            const res = await fetch(getUrl(`/server/${server.id}/roles/${selectedRole.id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, name: editRoleName, color: editRoleColor, permissions: editPermissions, position: selectedRole.position })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setRoles(prev => prev.map(r => r.id === selectedRole.id ? { ...r, name: editRoleName, color: editRoleColor } : r));
                alert("Rol kaydedildi!");
            } else alert(data.message);
        } catch (e) { alert(e.message); }
    };

    const handleDeleteRole = async () => {
        if (!selectedRole || !confirm(`"${selectedRole.name}" rolünü silmek istediğine emin misin?`)) return;
        try {
            await fetch(getUrl(`/server/${server.id}/roles/${selectedRole.id}?token=${authState.token}`), { method: 'DELETE' });
            setSelectedRole(null);
            fetchRoles();
        } catch (e) { alert(e.message); }
    };

    const bgColor = colors.background;
    const sidebarColor = colors.sidebar;
    const cardColor = colors.card;
    const textColor = colors.text;
    const mutedColor = colors.textMuted;
    const borderColor = colors.border || 'rgba(255,255,255,0.1)';

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bgColor, zIndex: 2000, display: 'flex', color: textColor }}>
            {/* LEFT SIDEBAR */}
            <div style={{ width: '280px', backgroundColor: sidebarColor, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', fontSize: '12px', fontWeight: 'bold', color: mutedColor, userSelect: 'none' }}>
                    {server.name.toUpperCase()}
                </div>
                <div
                    onClick={() => setActiveTab('overview')}
                    style={{ padding: '6px 20px', margin: '0 10px', borderRadius: '4px', cursor: 'pointer', backgroundColor: activeTab === 'overview' ? 'rgba(0,0,0,0.2)' : 'transparent', color: activeTab === 'overview' ? textColor : mutedColor }}
                >
                    Genel Görünüm
                </div>
                <div
                    onClick={() => setActiveTab('roles')}
                    style={{ padding: '6px 20px', margin: '2px 10px', borderRadius: '4px', cursor: 'pointer', backgroundColor: activeTab === 'roles' ? 'rgba(0,0,0,0.2)' : 'transparent', color: activeTab === 'roles' ? textColor : mutedColor }}
                >
                    Roller
                </div>

                <div style={{ marginTop: 'auto', padding: '20px' }}>
                    <div style={{ height: '1px', backgroundColor: borderColor, marginBottom: '10px' }}></div>
                    <div
                        onClick={onClose}
                        style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', color: mutedColor, display: 'flex', alignItems: 'center', gap: '5px' }}
                        className="interactive-button"
                    >
                        <span>⬅️</span> Geri Dön
                    </div>
                </div>
            </div>

            {/* RIGHT CONTENT */}
            <div style={{ flex: 1, backgroundColor: bgColor, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '60px 40px', maxWidth: '800px', width: '100%', height: '100%', overflowY: 'auto' }}>

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Sunucu Genel Görünümü</h2>

                            <div style={{ display: 'flex', gap: '40px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', color: mutedColor, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>SUNUCU ADI</label>
                                    <input
                                        value={serverName}
                                        onChange={(e) => setServerName(e.target.value)}
                                        style={{ width: '100%', padding: '10px', backgroundColor: cardColor, border: `1px solid ${borderColor}`, color: textColor, borderRadius: '4px', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: '#fff' }}>
                                        {server.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ fontSize: '12px', color: mutedColor }}>Görsel Yükle (Yakında)</div>
                                </div>
                            </div>

                            <button onClick={handleSaveOverview} style={{ marginTop: '40px', padding: '10px 20px', backgroundColor: '#3ba55c', color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>Değişiklikleri Kaydet</button>
                        </div>
                    )}

                    {/* ROLES TAB */}
                    {activeTab === 'roles' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Roller</h2>
                            <p style={{ color: mutedColor, marginBottom: '20px', fontSize: '14px' }}>Üyelerini gruplamak ve izin atamak için rolleri kullan.</p>

                            <div style={{ flex: 1, display: 'flex', border: `1px solid ${borderColor}`, borderRadius: '4px', overflow: 'hidden' }}>
                                {/* Role List */}
                                <div style={{ width: '200px', backgroundColor: sidebarColor, borderRight: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '10px', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor }}>ROLLER</span>
                                        <div onClick={handleCreateRole} style={{ cursor: 'pointer', fontSize: '16px', color: mutedColor }}>+</div>
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                                        {roles.map(role => (
                                            <div
                                                key={role.id}
                                                onClick={() => selectRole(role)}
                                                style={{
                                                    padding: '8px',
                                                    marginBottom: '2px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedRole?.id === role.id ? 'rgba(0,0,0,0.2)' : 'transparent',
                                                    color: selectedRole?.id === role.id ? textColor : mutedColor,
                                                    display: 'flex', alignItems: 'center', gap: '8px'
                                                }}
                                            >
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: role.color }}></div>
                                                {role.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Role Edit */}
                                <div style={{ flex: 1, backgroundColor: bgColor, padding: '20px' }}>
                                    {selectedRole ? (
                                        <>
                                            <div style={{ marginBottom: '20px' }}>
                                                <label style={{ display: 'block', color: mutedColor, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>ROL ADI</label>
                                                <input
                                                    value={editRoleName}
                                                    onChange={(e) => setEditRoleName(e.target.value)}
                                                    style={{ width: '100%', padding: '10px', backgroundColor: cardColor, border: `1px solid ${borderColor}`, color: textColor, borderRadius: '4px', outline: 'none' }}
                                                />
                                            </div>
                                            <div style={{ marginBottom: '20px' }}>
                                                <label style={{ display: 'block', color: mutedColor, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>ROL RENGİ</label>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <input type="color" value={editRoleColor} onChange={(e) => setEditRoleColor(e.target.value)} style={{ width: '50px', height: '40px', border: 'none', padding: 0, backgroundColor: 'transparent' }} />
                                                    <input value={editRoleColor} onChange={(e) => setEditRoleColor(e.target.value)} style={{ padding: '10px', backgroundColor: cardColor, border: `1px solid ${borderColor}`, color: textColor }} />
                                                </div>
                                            </div>
                                            <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '20px', display: 'flex', gap: '10px' }}>
                                                <button onClick={handleSaveRole} style={{ padding: '10px 20px', backgroundColor: '#3ba55c', color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>Kaydet</button>
                                                <button onClick={handleDeleteRole} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#ed4245', border: '1px solid #ed4245', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>Sil</button>
                                            </div>
                                        </>
                                    ) : <div style={{ color: mutedColor }}>Düzenlemek için bir rol seç.</div>}
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* ESC to close hint */}
                <div style={{ position: 'absolute', top: '20px', right: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                    <div onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${textColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', cursor: 'pointer', color: textColor }}>✕</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px', color: textColor }}>ESC</div>
                </div>
            </div>
        </div>
    );
};

export default ServerSettings;
