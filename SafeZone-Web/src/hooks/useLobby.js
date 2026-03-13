import { useState, useRef, useEffect } from 'react';
import { getUrl } from '../utils/api';
import SoundManager from '../utils/SoundManager';

export const useLobby = (authState, uuid, fetchServers, onFriendRequest, onUnreadDM, onOnlineUsersUpdate) => {
    const lobbyWs = useRef(null);
    const [onlineUserIds, setOnlineUserIds] = useState([]);
    const [userStatuses, setUserStatuses] = useState({});
    const [totalUsers, setTotalUsers] = useState(0);
    const [roomDetails, setRoomDetails] = useState({});
    const [ping, setPing] = useState(null);

    // DM State
    const [dmHistory, setDmHistory] = useState([]);
    const [selectedDM, setSelectedDM] = useState(null);
    const [dmTypingUser, setDmTypingUser] = useState(null);
    const [dmHasMore, setDmHasMore] = useState(false);
    const [dmIsLoadingMore, setDmIsLoadingMore] = useState(false);
    const dmTypingTimer = useRef(null);

    // Reconnect state
    const reconnectTimer = useRef(null);
    const reconnectDelay = useRef(1000); // starts at 1s, max 30s
    const shouldReconnect = useRef(true);

    // Connect
    const connectToLobby = () => {
        if (!authState.token || !authState.user?.username) return;

        if (lobbyWs.current) lobbyWs.current.close();
        // Use username for Lobby ID so backend updates the correct user row
        const wsUrl = getUrl(`/ws/lobby/${authState.user.username}?token=${encodeURIComponent(authState.token)}`, 'ws');
        lobbyWs.current = new WebSocket(wsUrl);

        lobbyWs.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'lobby_update') {
                    console.log("[useLobby] Update:", data);
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
                        if (onOnlineUsersUpdate) onOnlineUsersUpdate(data.online_users);
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

                    // Desktop notification
                    if (window.SAFEZONE_API?.notify && document.hidden) {
                        window.SAFEZONE_API.notify(
                            `DM - ${data.sender}`,
                            data.content.length > 80 ? data.content.slice(0, 80) + '…' : data.content
                        );
                    }

                    // Mark DM as unread if not currently viewing this conversation
                    if (!selectedDM || selectedDM.username !== data.sender) {
                        if (onUnreadDM) onUnreadDM(data.sender);
                    }
                } else if (data.type === 'dm_edited') {
                    // Update the message content in DM history
                    setDmHistory(prev => prev.map(m =>
                        m.id === data.message_id ? { ...m, content: data.new_content, edited_at: new Date().toISOString() } : m
                    ));
                } else if (data.type === 'dm_deleted') {
                    // Remove the deleted message from DM history
                    setDmHistory(prev => prev.filter(m => m.id !== data.message_id));
                } else if (data.type === 'dm_typing') {
                    setDmTypingUser(data.sender);
                    // Auto-clear typing indicator after 3 seconds
                    if (dmTypingTimer.current) clearTimeout(dmTypingTimer.current);
                    dmTypingTimer.current = setTimeout(() => setDmTypingUser(null), 3000);
                } else if (data.type === 'friend_request') {
                    // Friend request notification
                    SoundManager.playMessage();
                    if (onFriendRequest) onFriendRequest(data.sender, data.discriminator);
                } else if (data.type === 'pong') {
                    setPing(Date.now() - data.timestamp);
                }
            } catch (e) { console.error("Lobby msg error", e); }
        };
        lobbyWs.current.onerror = (err) => {
            console.warn('[useLobby] WebSocket error:', err);
        };

        lobbyWs.current.onclose = (event) => {
            console.warn(`[useLobby] Connection closed (code=${event.code}). shouldReconnect=${shouldReconnect.current}`);
            if (!shouldReconnect.current) return;
            // Schedule reconnect with exponential backoff
            reconnectTimer.current = setTimeout(() => {
                console.log(`[useLobby] Reconnecting after ${reconnectDelay.current}ms...`);
                reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
                connectToLobby();
            }, reconnectDelay.current);
        };

        lobbyWs.current.onopen = () => {
            console.log('[useLobby] Connected to Lobby WS.');
            reconnectDelay.current = 1000; // Reset delay on successful connection
        };
    }

    // Ping Loop + Auto-Reconnect lifecycle
    useEffect(() => {
        if (authState.token) {
            shouldReconnect.current = true;
            reconnectDelay.current = 1000;
            connectToLobby();
            const interval = setInterval(() => {
                if (lobbyWs.current?.readyState === WebSocket.OPEN) {
                    lobbyWs.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                }
            }, 5000);
            return () => {
                // Signal onclose NOT to reconnect (token changed = logout)
                shouldReconnect.current = false;
                clearInterval(interval);
                if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
                if (lobbyWs.current) lobbyWs.current.close();
            };
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
                body: JSON.stringify({ token: authState.token, username: friend.username, limit: 50 })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setDmHistory(data.messages);
                setDmHasMore(data.messages.length === 50);
            }
        } catch (e) { console.error(e); }
    }

    const loadMoreDMs = async () => {
        if (!selectedDM || dmIsLoadingMore || !dmHasMore) return;
        const firstId = dmHistory[0]?.id;
        if (!firstId) return;
        setDmIsLoadingMore(true);
        try {
            const res = await fetch(getUrl('/dm/history'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, username: selectedDM.username, before_id: firstId, limit: 50 })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setDmHistory(prev => [...data.messages, ...prev]);
                setDmHasMore(data.messages.length === 50);
            }
        } catch (e) { console.error(e); }
        finally { setDmIsLoadingMore(false); }
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

    const deleteDM = async (msg) => {
        if (!msg?.id) return;
        try {
            await fetch(getUrl('/dm/delete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, message_id: msg.id })
            });
            setDmHistory(prev => prev.filter(m => m.id !== msg.id));
        } catch (e) { console.error(e); }
    }

    const editDM = async (msgId, newContent) => {
        try {
            await fetch(getUrl('/dm/edit'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, message_id: msgId, content: newContent })
            });
            setDmHistory(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, text: newContent } : m));
        } catch (e) { console.error(e); }
    }

    // Typing indicator — debounced: called when user types in DM input
    const typingCooldown = useRef(null);
    const sendDMTyping = () => {
        if (!selectedDM) return;
        if (typingCooldown.current) return; // Throttle: send at most once per 2s
        typingCooldown.current = setTimeout(() => { typingCooldown.current = null; }, 2000);
        fetch(getUrl('/dm/typing'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: authState.token, receiver_username: selectedDM.username })
        }).catch(() => {});
    }

    return {
        onlineUserIds,
        userStatuses,
        totalUsers,
        roomDetails,
        ping,
        selectedDM, setSelectedDM,
        dmHistory, setDmHistory,
        dmHasMore,
        dmIsLoadingMore,
        dmTypingUser,

        startDM,
        sendDM,
        loadMoreDMs,
        deleteDM,
        editDM,
        sendDMTyping,
        handleStatusChange,
        connectToLobby
    };
}
