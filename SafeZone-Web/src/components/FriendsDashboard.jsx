import React, { useState } from 'react';
import { getUrl } from '../utils/api';
import UserFooter from './UserFooter'; // If needed inside or just layout

// Helper for status colors
const getStatusColor = (status) => {
    switch (status) {
        case 'online': return '#3BA55C';
        case 'idle': return '#FAA61A';
        case 'dnd': return '#ED4245';
        case 'invisible': return '#747F8D';
        default: return '#747F8D';
    }
};

const getStatusText = (status) => {
    switch (status) {
        case 'online': return 'Çevrimiçi';
        case 'idle': return 'Boşta';
        case 'dnd': return 'Rahatsız Etmeyin';
        case 'invisible': return 'Çevrimdışı';
        default: return 'Çevrimdışı';
    }
};

const FriendsDashboard = ({
    friends,
    friendRequests,
    onlineUserIds,
    userStatuses,
    handleRespondRequest,
    setShowAddFriend,
    handleStartDM,
    handleRemoveFriend,
    handleAddFriend, // New prop for Search/Add
    colors
}) => {
    const [activeTab, setActiveTab] = useState('online'); // online, all, pending, blocked, add_friend
    const [addFriendInput, setAddFriendInput] = useState('');

    // Filter Logic
    const safeFriends = friends || [];
    const onlineFriends = safeFriends.filter(f => onlineUserIds.includes(f.username) && userStatuses[f.username] !== 'invisible');
    const allFriends = safeFriends;
    const pendingRequests = friendRequests || [];

    const bgColor = colors?.background || '#36393f';
    const textColor = colors?.text || '#fff';
    const mutedColor = colors?.textMuted || '#b9bbbe';
    const borderColor = colors?.border || 'rgba(255,255,255,0.05)';
    const hoverColor = colors?.cardHover || 'rgba(79, 84, 92, 0.16)';

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: bgColor, height: '100%', color: textColor }}>

            {/* TOP BAR */}
            <div style={{
                height: '48px',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '20px', color: textColor, fontWeight: 'bold' }}>
                    <span style={{ color: '#8e9297' }}>👋</span>
                    Friends
                </div>
                <div style={{ width: '1px', height: '24px', backgroundColor: borderColor, marginRight: '20px' }}></div>

                <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
                    <div onClick={() => setActiveTab('online')} style={{ cursor: 'pointer', color: activeTab === 'online' ? textColor : mutedColor, fontWeight: activeTab === 'online' ? 'bold' : 'normal', padding: '2px 8px', borderRadius: '4px', backgroundColor: activeTab === 'online' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>Çevrimiçi</div>
                    <div onClick={() => setActiveTab('all')} style={{ cursor: 'pointer', color: activeTab === 'all' ? textColor : mutedColor, fontWeight: activeTab === 'all' ? 'bold' : 'normal', padding: '2px 8px', borderRadius: '4px', backgroundColor: activeTab === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>Tümü</div>
                    <div onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer', color: activeTab === 'pending' ? textColor : mutedColor, fontWeight: activeTab === 'pending' ? 'bold' : 'normal', padding: '2px 8px', borderRadius: '4px', backgroundColor: activeTab === 'pending' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
                        Bekleyen {pendingRequests.length > 0 && <span style={{ marginLeft: '5px', backgroundColor: '#ED4245', color: 'white', borderRadius: '50%', padding: '0 5px', fontSize: '10px' }}>{pendingRequests.length}</span>}
                    </div>
                    <div onClick={() => setActiveTab('add_friend')} style={{ cursor: 'pointer', color: activeTab === 'add_friend' ? '#2dc770' : '#2dc770', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', backgroundColor: activeTab === 'add_friend' ? 'rgba(0,0,0,0.1)' : 'transparent' }}>Arkadaş Ekle</div>
                </div>
            </div>

            {/* CONTENT */}
            <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>

                {activeTab === 'add_friend' && (
                    <div style={{ maxWidth: '600px' }}>
                        <h2 style={{ color: textColor, fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>ARKADAŞ EKLE</h2>
                        <div style={{ fontSize: '12px', color: mutedColor, marginBottom: '20px' }}>Kullanıcı adıyla arkadaş ekleyebilirsin (#0000 etiketini unutma!).</div>
                        <div style={{ display: 'flex', gap: '10px', height: '50px', backgroundColor: colors?.card || '#00000010', borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '0 15px', alignItems: 'center' }}>
                            <input
                                value={addFriendInput}
                                onChange={(e) => setAddFriendInput(e.target.value)}
                                placeholder="KullanıcıAdı#0000"
                                style={{ flex: 1, background: 'transparent', border: 'none', color: textColor, fontSize: '16px', outline: 'none' }}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddFriend(addFriendInput)}
                            />
                            <button
                                onClick={() => handleAddFriend(addFriendInput)}
                                disabled={!addFriendInput}
                                style={{
                                    backgroundColor: addFriendInput ? '#3ba55c' : '#3ba55c50',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '3px',
                                    padding: '10px 20px',
                                    cursor: addFriendInput ? 'pointer' : 'not-allowed',
                                    fontWeight: 'bold'
                                }}
                            >
                                Arkadaşlık İsteği Gönder
                            </button>
                        </div>
                        {/* Wumpus Image Placeholder */}
                        <div style={{ marginTop: '50px', textAlign: 'center', opacity: 0.5 }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🏞️</div>
                            <div style={{ color: mutedColor }}>Arkadaşlarını bulmak için bekleme, eklemeye başla!</div>
                        </div>
                    </div>
                )}

                {(activeTab === 'online' || activeTab === 'all') && (
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, marginBottom: '20px' }}>
                            {activeTab === 'online' ? `ÇEVRİMİÇİ — ${onlineFriends.length}` : `TÜM ARKADAŞLAR — ${allFriends.length}`}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {(activeTab === 'online' ? onlineFriends : allFriends).map(friend => {
                                const status = onlineUserIds.includes(friend.username) ? (userStatuses[friend.username] || 'online') : 'invisible';
                                // Only show in 'online' tab if status is NOT invisible
                                if (activeTab === 'online' && status === 'invisible') return null;

                                return (
                                    <div key={friend.username} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        borderTop: `1px solid ${borderColor}`,
                                        cursor: 'pointer'
                                    }}
                                        className="friend-item-hover"
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverColor}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        onClick={() => handleStartDM(friend)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                                                    {friend.username.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div style={{
                                                    width: '10px', height: '10px', borderRadius: '50%', position: 'absolute', bottom: -2, right: -2, border: `2px solid ${bgColor}`,
                                                    backgroundColor: getStatusColor(status)
                                                }}></div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ color: textColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {friend.display_name || friend.username}
                                                    <span style={{ fontSize: '12px', color: mutedColor, fontWeight: 'normal', opacity: 0 }}>#{friend.discriminator}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: mutedColor }}>{getStatusText(status)}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div title="Mesaj" style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: colors?.card || '#2f3136', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mutedColor, cursor: 'pointer' }}>💬</div>
                                            <div title="Diğer" onClick={(e) => { e.stopPropagation(); handleRemoveFriend(friend.username); }} style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: colors?.card || '#2f3136', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ed4245', cursor: 'pointer' }}>🗑️</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'pending' && (
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: mutedColor, marginBottom: '20px' }}>
                            BEKLEYEN İSTEKLER — {pendingRequests.length}
                        </div>
                        {pendingRequests.map(req => (
                            <div key={req.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderRadius: '8px', borderTop: `1px solid ${borderColor}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                        {req.username.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ color: textColor, fontWeight: 'bold' }}>{req.username}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => handleRespondRequest(req.username, 'accept')} style={{ padding: '8px', backgroundColor: 'transparent', border: 'none', color: '#3ba55c', cursor: 'pointer', fontSize: '16px' }}>✔️</button>
                                    <button onClick={() => handleRespondRequest(req.username, 'reject')} style={{ padding: '8px', backgroundColor: 'transparent', border: 'none', color: '#ed4245', cursor: 'pointer', fontSize: '16px' }}>✖️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};

export default FriendsDashboard;
