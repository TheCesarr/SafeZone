import { useState, useRef, useEffect } from 'react';
import { getUrl } from '../utils/api';
import SoundManager from '../utils/SoundManager';

export const useLobby = (authState, uuid, fetchServers) => {
    const lobbyWs = useRef(null);
    const [onlineUserIds, setOnlineUserIds] = useState([]);
    const [userStatuses, setUserStatuses] = useState({});
    const [totalUsers, setTotalUsers] = useState(0);
    const [roomDetails, setRoomDetails] = useState({});
    const [ping, setPing] = useState(null);

    // DM State
    const [dmHistory, setDmHistory] = useState([]);
    const [selectedDM, setSelectedDM] = useState(null);

    // Connect
    const connectToLobby = () => {
        if (!authState.token || !uuid.current) return;

        if (lobbyWs.current) lobbyWs.current.close();
        const wsUrl = getUrl(`/ws/lobby/${uuid.current}`, 'ws');
        lobbyWs.current = new WebSocket(wsUrl);

        lobbyWs.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'lobby_update') {
                    setTotalUsers(data.total_online);
                    setRoomDetails(data.room_details || {});

                    // Parse Online Users
                    const ids = [];
                    const statuses = {};
                    if (data.online_users && data.online_users.length > 0) {
                        data.online_users.forEach(u => {
                            if (typeof u === 'string') {
                                ids.push(u); // Legacy support
                            } else {
                                if (u.status === 'invisible' && u.username !== uuid.current) return;
                                ids.push(u.username);
                                statuses[u.username] = u.status;
                            }
                        });
                    }
                    setOnlineUserIds(ids);
                    setUserStatuses(prev => ({ ...prev, ...statuses }));

                    // Trigger server refresh to update channel user counts if needed
                    if (fetchServers) fetchServers();

                } else if (data.type === 'dm_received') {
                    if (selectedDM && selectedDM.username === data.sender) {
                        setDmHistory(prev => [...prev, {
                            sender: data.sender,
                            content: data.content,
                            timestamp: data.timestamp
                        }]);
                    }
                    SoundManager.playMessage(); // Notification sound
                } else if (data.type === 'pong') {
                    setPing(Date.now() - data.timestamp);
                }
            } catch (e) { console.error("Lobby msg error", e); }
        };
    }

    // Ping Loop
    useEffect(() => {
        if (authState.token) {
            connectToLobby();
            const interval = setInterval(() => {
                if (lobbyWs.current?.readyState === WebSocket.OPEN) {
                    lobbyWs.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                }
            }, 5000);
            return () => {
                clearInterval(interval);
                if (lobbyWs.current) lobbyWs.current.close();
            }
        }
    }, [authState.token]);

    const handleStatusChange = (newStatus) => {
        if (lobbyWs.current?.readyState === WebSocket.OPEN) {
            lobbyWs.current.send(JSON.stringify({ type: 'status_update', status: newStatus }));
        }
    }

    // DM Actions
    const fetchDMHistory = async (friend) => {
        try {
            const res = await fetch(getUrl('/dm/history'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, username: friend.username })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setDmHistory(data.messages);
            }
        } catch (e) { console.error(e); }
    }

    const startDM = (friend) => {
        setSelectedDM(friend);
        fetchDMHistory(friend);
    }

    const sendDM = (content) => {
        if (!selectedDM || !content.trim()) return;

        // Optimistic
        setDmHistory(prev => [...prev, {
            sender: authState.user.username,
            content: content,
            timestamp: new Date().toISOString()
        }]);

        fetch(getUrl('/dm/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: authState.token,
                receiver_username: selectedDM.username,
                content: content
            })
        });
    }

    return {
        onlineUserIds,
        userStatuses,
        totalUsers,
        roomDetails,
        ping,
        selectedDM, setSelectedDM,
        dmHistory, setDmHistory,

        startDM,
        sendDM,
        handleStatusChange,
        connectToLobby
    };
}
