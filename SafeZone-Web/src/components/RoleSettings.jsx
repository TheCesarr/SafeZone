import React, { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';

const RoleSettings = ({ serverId, token }) => {
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(false);

    // Edit Strings
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("#99AAB5");
    const [editPermissions, setEditPermissions] = useState(0);

    useEffect(() => {
        fetchRoles();
    }, [serverId]);

    const fetchRoles = async (targetRoleId = null) => {
        setLoading(true);
        try {
            const res = await fetch(getUrl(`/server/${serverId}/roles`));
            const data = await res.json();
            if (data.status === 'success') {
                // Sort by position desc (Discord style: high position = top of list)
                const sorted = data.roles.sort((a, b) => b.position - a.position);
                setRoles(sorted);

                if (targetRoleId) {
                    const target = sorted.find(r => r.id === targetRoleId);
                    if (target) selectRole(target);
                } else if (selectedRole) {
                    // Refresh selectedRole with new data to avoid stale state
                    const updated = sorted.find(r => r.id === selectedRole.id);
                    if (updated) setSelectedRole(updated); // Don't call selectRole to avoid resetting edits if user is typing
                    else setSelectedRole(null); // Role deleted?
                } else if (sorted.length > 0) {
                    selectRole(sorted[0]);
                }
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const selectRole = (role) => {
        setSelectedRole(role);
        setEditName(role.name);
        setEditColor(role.color);
        setEditPermissions(role.permissions);
    };

    const handleCreateRole = async () => {
        try {
            const res = await fetch(getUrl(`/server/${serverId}/roles`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    name: "yeni rol",
                    color: "#99AAB5",
                    permissions: 0
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                // Backend now returns the created role object in data.role
                const newRoleId = data.role ? data.role.id : null;
                fetchRoles(newRoleId);
            } else alert(data.message);
        } catch (e) { alert(e.message); }
    };

    const handleSaveRole = async () => {
        if (!selectedRole) return;
        try {
            const res = await fetch(getUrl(`/server/${serverId}/roles/${selectedRole.id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    name: editName,
                    color: editColor,
                    permissions: editPermissions,
                    position: selectedRole.position // Keep position same for now (TODO: Reordering)
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                // Update local list
                setRoles(prev => prev.map(r => r.id === selectedRole.id ? { ...r, name: editName, color: editColor, permissions: editPermissions } : r));
                alert("Rol kaydedildi!");
            } else alert(data.message);
        } catch (e) { alert(e.message); }
    };

    const handleDeleteRole = async () => {
        if (!selectedRole || !confirm(`"${selectedRole.name}" rolünü silmek istediğine emin misin?`)) return;
        try {
            const res = await fetch(getUrl(`/server/${serverId}/roles/${selectedRole.id}?token=${token}`), {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSelectedRole(null);
                fetchRoles();
            } else alert(data.message);
        } catch (e) { alert(e.message); }
    };

    return (
        <div style={{ display: 'flex', height: '100%', color: '#fff' }}>
            {/* Sidebar List */}
            <div style={{ width: '200px', backgroundColor: '#2f3136', padding: '10px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#b9bbbe' }}>ROLLER</h3>
                    <button onClick={handleCreateRole} style={{ background: 'none', border: 'none', color: '#b9bbbe', cursor: 'pointer', fontSize: '16px' }}>+</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {roles.map(role => (
                        <div
                            key={role.id}
                            onClick={() => selectRole(role)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                backgroundColor: selectedRole?.id === role.id ? 'rgba(79,84,92,0.6)' : 'transparent',
                                color: selectedRole?.id === role.id ? '#fff' : '#b9bbbe',
                                marginBottom: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: role.color }}></div>
                            {role.name}
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Area */}
            <div style={{ flex: 1, backgroundColor: '#36393f', padding: '20px', overflowY: 'auto' }}>
                {selectedRole ? (
                    <div>
                        <h2 style={{ marginBottom: '20px' }}>Rolu Düzenle - {selectedRole.name.toUpperCase()}</h2>

                        <div key={selectedRole.id} style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: '#b9bbbe', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>ROL ADI</label>
                            <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    backgroundColor: '#202225',
                                    border: '1px solid #202225',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007AFF'}
                                onBlur={(e) => e.target.style.borderColor = '#202225'}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: '#b9bbbe', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>ROL RENGİ</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '60px', height: '60px', overflow: 'hidden', borderRadius: '4px', border: '1px solid #202225' }}>
                                    <input
                                        type="color"
                                        value={editColor}
                                        onChange={(e) => setEditColor(e.target.value)}
                                        style={{
                                            position: 'absolute',
                                            top: '-10px',
                                            left: '-10px',
                                            width: '80px',
                                            height: '80px',
                                            cursor: 'pointer',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            padding: 0
                                        }}
                                    />
                                </div>
                                <input
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    placeholder="#RRGGBB"
                                    maxLength={7}
                                    style={{
                                        padding: '10px',
                                        backgroundColor: '#202225',
                                        border: '1px solid #202225',
                                        color: '#fff',
                                        borderRadius: '4px',
                                        outline: 'none',
                                        fontFamily: 'monospace',
                                        textTransform: 'uppercase'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#007AFF'}
                                    onBlur={(e) => e.target.style.borderColor = '#202225'}
                                />
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSaveRole}
                                style={{ padding: '10px 20px', backgroundColor: '#3ba55c', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Değişiklikleri Kaydet
                            </button>
                            <button
                                onClick={handleDeleteRole}
                                style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#ed4245', border: '1px solid #ed4245', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Rolü Sil
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#72767d' }}>
                        Bir rol seç veya oluştur.
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoleSettings;
