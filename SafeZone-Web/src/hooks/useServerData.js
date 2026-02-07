import { useState, useRef } from 'react';
import { getUrl } from '../utils/api';

export const useServerData = (authState) => {
    // Data State
    const [myServers, setMyServers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
    const [serverMembers, setServerMembers] = useState([]);

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
        if (server) {
            fetchMembers(server.id);
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
                alert(data.message);
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
                alert(data.message);
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
            // Check if owner logic should be handled by UI or Backend? 
            // Usually we call /server/leave, if owner it fails or we call /server/delete.
            // Let's check permissions locally if possible or just try leave.
            const server = myServers.find(s => s.id === serverId);
            const isOwner = server?.owner_id === authState.user.id;

            const endpoint = isOwner ? '/server/delete' : '/server/leave';

            const res = await fetch(getUrl(endpoint), {
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
                alert(data.message);
                return false;
            }
        } catch (e) { console.error(e); }
    }

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
                alert(data.message);
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    // --- FRIENDS ---
    const addFriend = async (friendTag) => {
        try {
            const res = await fetch(getUrl('/friends/add'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, friend_tag: friendTag })
            });
            const data = await res.json();
            if (data.status === 'success') { fetchFriends(); return true; }
            else { alert(data.message); return false; }
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

    const respondFriendRequest = async (requestId, action) => {
        try {
            await fetch(getUrl('/friends/respond'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, request_id: requestId, action: action })
            });
            fetchFriends();
        } catch (e) { console.error(e); }
    }

    const blockUser = async (user) => {
        if (!window.confirm(`${user.username} engellensin mi?`)) return;
        // Mock Implementation or Real Endpoint if exists
        alert("Engelleme özelliği yakında!");
    }

    return {
        myServers,
        friends, setFriends,
        friendRequests,
        serverMembers,
        selectedServer, selectServer,
        selectedChannel, setSelectedChannel,

        fetchServers,
        fetchMembers,
        fetchFriends,

        handleCreateServer,
        handleJoinServer,
        handleLeaveServer,
        handleCreateChannel,

        addFriend,
        removeFriend,
        respondFriendRequest,
        blockUser
    };
}
