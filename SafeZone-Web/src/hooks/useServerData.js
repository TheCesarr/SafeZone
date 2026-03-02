import { useState, useRef } from 'react';
import { getUrl } from '../utils/api';
import toast from '../utils/toast';

export const useServerData = (authState) => {
    // Data State
    const [myServers, setMyServers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
    const [serverMembers, setServerMembers] = useState([]);
    const [serverRoles, setServerRoles] = useState([]); // Fix 5: Role list for current server

    // UI Selection State
    const [selectedServer, setSelectedServer] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);

    // Helpers
    const fetchServers = async () => {
        if (!authState.token) return;
        try {
            // First fetch friends to ensure data is ready (Parallel optional)
            fetchFriends();

            const res = await fetch(getUrl(`/server/list?token=${authState.token}`));
            const data = await res.json();
            if (data.status === 'success') {
                setMyServers(data.servers);
                // If currently selected server exists in new list, update it (for channels)
                if (selectedServer) {
                    const updated = data.servers.find(s => s.id === selectedServer.id);
                    if (updated) setSelectedServer(updated);
                }
            }
        } catch (e) { console.error(e); }
    }

    const fetchMembers = async (serverId) => {
        try {
            const res = await fetch(getUrl(`/server/${serverId}/members?token=${authState.token}`));
            const data = await res.json();
            if (data.status === 'success') {
                setServerMembers(data.members);
            }
        } catch (e) {
            console.error("Member fetch error:", e);
        }
    }

    const fetchRoles = async (serverId) => {
        try {
            const res = await fetch(getUrl(`/server/${serverId}/roles?token=${authState.token}`));
            const data = await res.json();
            if (data.status === 'success') {
                setServerRoles(data.roles || []);
            }
        } catch (e) {
            console.error("Roles fetch error:", e);
        }
    }

    const fetchFriends = async () => {
        if (!authState.token) return;
        try {
            const res = await fetch(getUrl(`/friends?token=${authState.token}`));
            const data = await res.json();
            if (data.status === 'success') {
                setFriends(data.friends);
                setFriendRequests(data.requests);
            }
        } catch (e) { console.error(e); }
    }

    const selectServer = (server) => {
        setSelectedServer(server);
        setSelectedChannel(null); // Reset channel when switching server
        setServerRoles([]); // Reset roles for new server
        if (server) {
            fetchMembers(server.id);
            fetchRoles(server.id); // Fix 5: Load roles for role assignment UI
            localStorage.setItem('safezone_last_server', server.id);

            // Auto-select first text channel (Discord behavior)
            const firstText = server.channels.find(c => c.type === 'text');
            if (firstText) setSelectedChannel(firstText);
        } else {
            localStorage.removeItem('safezone_last_server');
        }
    }

    // --- ACTIONS ---

    const handleCreateServer = async (serverName) => {
        try {
            const res = await fetch(getUrl('/server/create'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, name: serverName })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await fetchServers();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    const handleJoinServer = async (inviteCode) => {
        try {
            const res = await fetch(getUrl('/server/join'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, invite_code: inviteCode })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await fetchServers();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    const handleLeaveServer = async (serverId) => {
        if (!window.confirm("Bu sunucudan ayrılmak istiyor musun?")) return;
        try {
            const res = await fetch(getUrl('/server/leave'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, server_id: serverId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSelectedServer(null);
                await fetchServers();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) { console.error(e); }
    };

    const handleDeleteServer = async (serverId) => {
        if (!window.confirm("Bu sunucuyu silmek istediğine emin misin? Bu işlem geri alınamaz!")) return;
        try {
            const res = await fetch(getUrl('/server/delete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, server_id: serverId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSelectedServer(null);
                await fetchServers();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) { console.error(e); }
    };

    const kickMember = async (targetUsername) => {
        if (!selectedServer || !window.confirm(`"${targetUsername}" kullanıcısını atmak istediğine emin misin?`)) return;
        try {
            const member = serverMembers.find(m => m.username === targetUsername);
            if (!member) return;
            const res = await fetch(getUrl(`/server/${selectedServer.id}/kick`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, target_user_id: member.id })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success('Kullanıcı atıldı');
                await fetchServerMembers(selectedServer.id);
            } else toast.error(data.message);
        } catch (e) { toast.error(e.message); }
    };

    const banMember = async (targetUsername) => {
        if (!selectedServer || !window.confirm(`"${targetUsername}" kullanıcısını yasaklamak istediğine emin misin?`)) return;
        try {
            const member = serverMembers.find(m => m.username === targetUsername);
            if (!member) return;
            const res = await fetch(getUrl(`/server/${selectedServer.id}/ban`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, target_user_id: member.id, reason: "Admin Action" })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success('Kullanıcı yasaklandı');
                await fetchServerMembers(selectedServer.id);
            } else toast.error(data.message);
        } catch (e) { toast.error(e.message); }
    };

    const assignRole = async (targetUsername, roleId) => {
        if (!selectedServer) return;
        try {
            const member = serverMembers.find(m => m.username === targetUsername);
            if (!member) return;
            const res = await fetch(getUrl(`/server/${selectedServer.id}/roles/${roleId}/assign`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, user_id: member.id })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success('Rol atandı');
                await fetchServerMembers(selectedServer.id);
            } else toast.error(data.message);
        } catch (e) { toast.error(e.message); }
    };

    const unassignRole = async (targetUsername, roleId) => {
        if (!selectedServer) return;
        try {
            const member = serverMembers.find(m => m.username === targetUsername);
            if (!member) return;
            const res = await fetch(getUrl(`/server/${selectedServer.id}/roles/${roleId}/unassign`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, user_id: member.id })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success('Rol alındı');
                await fetchServerMembers(selectedServer.id);
            } else toast.error(data.message);
        } catch (e) { toast.error(e.message); }
    };

    const handleCreateChannel = async (server_id, channelName, type) => {
        try {
            const res = await fetch(getUrl('/channel/create'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: authState.token,
                    server_id: server_id,
                    channel_name: channelName,
                    channel_type: type
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                fetchServers(); // Refresh list to show new channel
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    const handleDeleteChannel = async (channelId) => {
        if (!window.confirm("Bu odayı silmek istediğine emin misin?")) return false;
        try {
            const res = await fetch(getUrl('/channel/delete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: authState.token,
                    channel_id: channelId
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (selectedChannel?.id === channelId) setSelectedChannel(null);
                fetchServers();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleRenameChannel = async (channelId, newName) => {
        if (!newName || newName.trim() === '') return false;
        try {
            const res = await fetch(getUrl('/channel/rename'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: authState.token,
                    channel_id: channelId,
                    new_name: newName.trim()
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (selectedChannel?.id === channelId) {
                    setSelectedChannel(prev => ({ ...prev, name: newName.trim() }));
                }
                fetchServers();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    // --- FRIENDS ---
    const addFriend = async (friendTag) => {
        try {
            const res = await fetch(getUrl('/friends/add'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, friend_tag: friendTag })
            });
            const data = await res.json();
            if (data.status === 'success') { toast.success("Arkadaşlık isteği gönderildi!"); fetchFriends(); return true; }
            else { toast.error(data.message); return false; }
        } catch (e) { console.error(e); return false; }
    }

    const removeFriend = async (friendId) => {
        if (!window.confirm("Arkadaşlıktan çıkarmak istiyor musun?")) return;
        try {
            await fetch(getUrl('/friends/remove'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, friend_id: friendId })
            });
            fetchFriends();
        } catch (e) { console.error(e); }
    }

    const respondFriendRequest = async (senderUsername, action) => {
        try {
            const res = await fetch(getUrl('/friends/respond'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, sender_username: senderUsername, action: action })
            });
            const data = await res.json();
            if (data.status === 'success') {
                toast.success(action === 'accept' ? 'Arkadaşlık kabul edildi!' : 'İstek reddedildi.');
            }
            fetchFriends();
        } catch (e) { console.error(e); }
    }

    const blockUser = async (user) => {
        if (!window.confirm(`${user.username} engellensin mi?`)) return;
        // Mock Implementation or Real Endpoint if exists
        toast.warning("Engelleme özelliği yakında!");
    }

    return {
        myServers,
        friends, setFriends,
        friendRequests,
        serverMembers, setServerMembers,
        serverRoles, // Fix 5: Exposed roles for ProfileCard
        selectedServer, selectServer,
        selectedChannel, setSelectedChannel,

        fetchServers,
        fetchMembers,
        fetchFriends,

        handleCreateServer,
        handleJoinServer,
        handleLeaveServer,
        handleDeleteServer,
        handleCreateChannel,
        handleDeleteChannel,
        handleRenameChannel,

        addFriend,
        removeFriend,
        respondFriendRequest,
        blockUser,
        kickMember,
        banMember,
        assignRole,
        unassignRole
    };
}
