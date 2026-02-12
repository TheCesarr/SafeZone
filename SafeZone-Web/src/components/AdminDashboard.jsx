import React, { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';
import { useToast } from '../hooks/useToast';

const AdminDashboard = ({ authState, onLogout, colors, onJoinServer, onSwitchToClient }) => {
    const [activeTab, setActiveTab] = useState('overview'); // overview, users, servers
    const [stats, setStats] = useState({ users: '-', servers: '-', total_servers: '-' });
    const [users, setUsers] = useState([]);
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    // Helper for API calls
    const fetchAPI = async (endpoint, method = 'GET', body = null) => {
        try {
            const options = {
                method,
                headers: {
                    'Authorization': `Bearer ${authState.token}`,
                    'Content-Type': 'application/json'
                }
            };
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(getUrl(endpoint), options);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(errData.detail || 'API Error');
            }
            return await res.json();
        } catch (e) {
            console.error(e);
            showToast(`Hata: ${e.message}`, 'error');
            return null;
        }
    };

    const fetchStats = async () => {
        const data = await fetchAPI('/admin/stats');
        if (data) setStats(data);
    };

    const fetchUsers = async () => {
        setLoading(true);
        const data = await fetchAPI('/admin/users');
        if (data) setUsers(data);
        setLoading(false);
    };

    const fetchServers = async () => {
        setLoading(true);
        const data = await fetchAPI('/admin/servers');
        if (data) setServers(data);
        setLoading(false);
    };

    const handleJoinClick = async (serverId) => {
        const res = await fetchAPI('/admin/join-server', 'POST', { server_id: serverId });
        if (res) {
            showToast(res.message, 'success');
            // Check if we need to switch view
            const server = servers.find(s => s.id === serverId);
            if (server && onJoinServer) onJoinServer(server);
        }
    }

    const handleSoftDelete = async (serverId) => {
        if (!window.confirm('Sunucu durumunu değiştirmek (Aktif/Silinmiş) istiyor musunuz?')) return;
        const res = await fetchAPI(`/admin/server/${serverId}`, 'DELETE');
        if (res) {
            showToast(res.message, 'success');
            fetchServers();
            fetchStats();
        }
    }

    // --- MODAL STATE & HANDLERS ---
    const [editingUser, setEditingUser] = useState(null);
    const [editingServer, setEditingServer] = useState(null);
    const [editForm, setEditForm] = useState({});

    const openEditUser = (user) => {
        setEditForm({
            username: user.username,
            display_name: user.display_name,
            email: user.email,
            is_sysadmin: !!user.is_sysadmin,
            password: ""
        });
        setEditingUser(user);
    };

    const openEditServer = (server) => {
        setEditForm({
            name: server.name,
            owner_id: server.owner_id
        });
        setEditingServer(server);
    };

    const closeModals = () => {
        setEditingUser(null);
        setEditingServer(null);
        setEditForm({});
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        const body = { ...editForm };
        if (!body.password) delete body.password; // Don't send empty password

        const res = await fetchAPI(`/admin/user/${editingUser.id}`, 'PUT', body);
        if (res) {
            showToast(res.message, 'success');
            fetchUsers();
            closeModals();
        }
    };

    const handleSaveServer = async () => {
        if (!editingServer) return;
        const res = await fetchAPI(`/admin/server/${editingServer.id}`, 'PUT', editForm);
        if (res) {
            showToast(res.message, 'success');
            fetchServers();
            closeModals();
        }
    };

    useEffect(() => {
        if (activeTab === 'overview') fetchStats();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'servers') fetchServers();
    }, [activeTab]);

    // Styles
    const cardStyle = {
        background: '#2f3136',
        padding: 20,
        borderRadius: 8,
        flex: 1,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    };
    const tableHeaderStyle = { textAlign: 'left', padding: '10px', borderBottom: '1px solid #40444b', color: '#b9bbbe' };
    const tableCellStyle = { padding: '10px', borderBottom: '1px solid #2f3136' };
    const buttonStyle = { padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 'bold' };

    // Render Content
    const renderContent = () => {
        if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

        switch (activeTab) {
            case 'overview':
                return (
                    <div style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>
                        <h2 style={{ marginBottom: 30, fontSize: 24 }}>Sistem Özeti</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                            <div style={cardStyle}>
                                <h3 style={{ color: '#b9bbbe', fontSize: 14, textTransform: 'uppercase' }}>Toplam Kullanıcı</h3>
                                <p style={{ fontSize: 36, fontWeight: 'bold', margin: '10px 0', color: '#5865F2' }}>{stats.users}</p>
                            </div>
                            <div style={cardStyle}>
                                <h3 style={{ color: '#b9bbbe', fontSize: 14, textTransform: 'uppercase' }}>Aktif Sunucular</h3>
                                <p style={{ fontSize: 36, fontWeight: 'bold', margin: '10px 0', color: '#3BA55C' }}>{stats.servers}</p>
                            </div>
                            <div style={cardStyle}>
                                <h3 style={{ color: '#b9bbbe', fontSize: 14, textTransform: 'uppercase' }}>Toplam Sunucu (Silinenler Dahil)</h3>
                                <p style={{ fontSize: 36, fontWeight: 'bold', margin: '10px 0', color: '#FAA61A' }}>{stats.total_servers}</p>
                            </div>
                        </div>
                    </div>
                );
            case 'users':
                return (
                    <div style={{ padding: 20 }}>
                        <h2 style={{ marginBottom: 20 }}>Kullanıcı Yönetimi ({users.length})</h2>
                        <div style={{ background: '#2f3136', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#dcddde' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>ID</th>
                                        <th style={tableHeaderStyle}>Kullanıcı Adı</th>
                                        <th style={tableHeaderStyle}>E-Posta</th>
                                        <th style={tableHeaderStyle}>Yetki</th>
                                        <th style={tableHeaderStyle}>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td style={tableCellStyle}>#{u.id}</td>
                                            <td style={tableCellStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {u.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{u.display_name}</div>
                                                        <div style={{ fontSize: 12, color: '#b9bbbe' }}>@{u.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={tableCellStyle}>{u.email || '-'}</td>
                                            <td style={tableCellStyle}>
                                                {u.is_sysadmin ?
                                                    <span style={{ background: '#ED4245', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>ADMIN</span> :
                                                    <span style={{ background: '#5865F2', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>ÜYE</span>
                                                }
                                            </td>
                                            <td style={tableCellStyle}>
                                                <button onClick={() => openEditUser(u)} style={{ ...buttonStyle, background: '#4f545c', fontSize: 12 }}>Düzenle</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'servers':
                return (
                    <div style={{ padding: 20 }}>
                        <h2 style={{ marginBottom: 20 }}>Sunucu Yönetimi ({servers.length})</h2>
                        <div style={{ background: '#2f3136', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#dcddde' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>ID</th>
                                        <th style={tableHeaderStyle}>Sunucu Adı</th>
                                        <th style={tableHeaderStyle}>Kurucu</th>
                                        <th style={tableHeaderStyle}>Durum</th>
                                        <th style={tableHeaderStyle}>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {servers.map(s => {
                                        const isDeleted = !!s.deleted_at;
                                        return (
                                            <tr key={s.id} style={{ opacity: isDeleted ? 0.6 : 1 }}>
                                                <td style={tableCellStyle}>{s.id}</td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3BA55C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {s.name[0]}
                                                        </div>
                                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{s.name}</div>
                                                    </div>
                                                </td>
                                                <td style={tableCellStyle}>@{s.owner_name}</td>
                                                <td style={tableCellStyle}>
                                                    {isDeleted ?
                                                        <span style={{ color: '#ED4245', fontWeight: 'bold' }}>SİLİNDİ</span> :
                                                        <span style={{ color: '#3BA55C', fontWeight: 'bold' }}>AKTİF</span>
                                                    }
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ display: 'flex', gap: 10 }}>
                                                        <button
                                                            onClick={() => openEditServer(s)}
                                                            style={{ ...buttonStyle, background: '#4f545c' }}
                                                            title="Düzenle"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleJoinClick(s.id)}
                                                            style={{ ...buttonStyle, background: '#5865F2' }}
                                                            title="Katıl"
                                                        >
                                                            🔗
                                                        </button>
                                                        <button
                                                            onClick={() => handleSoftDelete(s.id)}
                                                            style={{ ...buttonStyle, background: isDeleted ? '#3BA55C' : '#ED4245' }}
                                                            title={isDeleted ? "Geri Yükle" : "Sil (Soft)"}
                                                        >
                                                            {isDeleted ? '♻️' : '🗑️'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#202225', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            {/* Sidebar */}
            <div style={{ width: 250, background: '#2f3136', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 20, borderBottom: '1px solid #202225' }}>
                    <h1 style={{ fontSize: 18, fontWeight: 'bold', color: '#ed4245', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span>🛡️</span> SafeZone
                    </h1>
                    <p style={{ fontSize: 12, color: '#b9bbbe', marginTop: 5 }}>Admin Paneli v2.0</p>
                </div>

                <div style={{ flex: 1, padding: 10 }}>
                    <div onClick={() => setActiveTab('overview')} style={{ padding: '10px 15px', borderRadius: 4, cursor: 'pointer', background: activeTab === 'overview' ? '#40444b' : 'transparent', marginBottom: 5, color: activeTab === 'overview' ? '#fff' : '#b9bbbe' }}>📊 Özet</div>
                    <div onClick={() => setActiveTab('users')} style={{ padding: '10px 15px', borderRadius: 4, cursor: 'pointer', background: activeTab === 'users' ? '#40444b' : 'transparent', marginBottom: 5, color: activeTab === 'users' ? '#fff' : '#b9bbbe' }}>👥 Kullanıcılar</div>
                    <div onClick={() => setActiveTab('servers')} style={{ padding: '10px 15px', borderRadius: 4, cursor: 'pointer', background: activeTab === 'servers' ? '#40444b' : 'transparent', marginBottom: 5, color: activeTab === 'servers' ? '#fff' : '#b9bbbe' }}>🖥️ Sunucular</div>
                </div>

                <div style={{ padding: 20, borderTop: '1px solid #202225' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                            {authState.user.username[0].toUpperCase()}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 'bold', fontSize: 14, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{authState.user.username}</div>
                            <div style={{ fontSize: 10, color: '#b9bbbe' }}>System Admin</div>
                        </div>
                    </div>
                    {onSwitchToClient && (
                        <button onClick={onSwitchToClient} style={{ width: '100%', padding: 10, marginBottom: 10, background: '#5865F2', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Client UI Geç</button>
                    )}
                    <button onClick={onLogout} style={{ width: '100%', padding: 10, background: '#ed4245', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Çıkış Yap</button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#36393f' }}>
                {renderContent()}
            </div>

            {/* EDIT USER MODAL */}
            {editingUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#36393f', padding: 20, borderRadius: 8, width: 400 }}>
                        <h3 style={{ marginBottom: 20 }}>Kullanıcı Düzenle</h3>
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: '#b9bbbe' }}>Kullanıcı Adı</label>
                            <input maxLength="16" value={editForm.username || ''} onChange={e => setEditForm({ ...editForm, username: e.target.value })} style={{ width: '100%', padding: 10, background: '#202225', border: 'none', color: '#fff', borderRadius: 4 }} />
                        </div>
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: '#b9bbbe' }}>Görünen İsim</label>
                            <input maxLength="16" value={editForm.display_name || ''} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} style={{ width: '100%', padding: 10, background: '#202225', border: 'none', color: '#fff', borderRadius: 4 }} />
                        </div>
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: '#b9bbbe' }}>E-Posta</label>
                            <input value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ width: '100%', padding: 10, background: '#202225', border: 'none', color: '#fff', borderRadius: 4 }} />
                        </div>
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: '#b9bbbe' }}>Şifre (Değiştirmek için doldur)</label>
                            <input type="password" value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} style={{ width: '100%', padding: 10, background: '#202225', border: 'none', color: '#fff', borderRadius: 4 }} placeholder="Boş bırakırsan değişmez" />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'flex', alignItems: 'center', color: '#fff', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editForm.is_sysadmin || false} onChange={e => setEditForm({ ...editForm, is_sysadmin: e.target.checked })} style={{ marginRight: 10 }} />
                                System Admin Yetkisi
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={closeModals} style={{ padding: '10px 20px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>İptal</button>
                            <button onClick={handleSaveUser} style={{ padding: '10px 20px', background: '#3BA55C', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Kaydet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT SERVER MODAL */}
            {editingServer && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#36393f', padding: 20, borderRadius: 8, width: 400 }}>
                        <h3 style={{ marginBottom: 20 }}>Sunucu Düzenle</h3>
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: '#b9bbbe' }}>Sunucu Adı</label>
                            <input maxLength="16" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%', padding: 10, background: '#202225', border: 'none', color: '#fff', borderRadius: 4 }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: '#b9bbbe' }}>Sahip ID (Owner ID)</label>
                            <input type="number" value={editForm.owner_id || ''} onChange={e => setEditForm({ ...editForm, owner_id: parseInt(e.target.value) })} style={{ width: '100%', padding: 10, background: '#202225', border: 'none', color: '#fff', borderRadius: 4 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={closeModals} style={{ padding: '10px 20px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>İptal</button>
                            <button onClick={handleSaveServer} style={{ padding: '10px 20px', background: '#3BA55C', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
