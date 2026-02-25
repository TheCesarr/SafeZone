import { useState, useRef, useEffect } from 'react';
import { getUrl } from '../utils/api';
import SoundManager from '../utils/SoundManager';
import toast from '../utils/toast';

const PAGE_SIZE = 50;

// v2: Added connectToChannel and message handling
export const useChat = (authState, uuid, chatWs, roomWs, onUnreadMessage) => {
    const currentUsername = authState.user?.username || '';

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [attachment, setAttachment] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const lastTypingTimeRef = useRef(0);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [messageContextMenu, setMessageContextMenu] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editText, setEditText] = useState("");
    const typingTimeouts = useRef({});

    // Infinite scroll state
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const currentChannelId = useRef(null);

    // --- CONNECTION ---
    const connectToChannel = (channel) => {
        if (!channel || channel.type === 'voice') return;

        if (chatWs.current) chatWs.current.close();
        const userId = authState.user?.username || uuid.current;
        const wsUrl = getUrl(`/ws/room/${channel.id}/${userId}?token=${encodeURIComponent(authState.token)}`, 'ws');
        chatWs.current = new WebSocket(wsUrl);

        chatWs.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            handleIncomingMessage(msg);
        };
    }

    const handleIncomingMessage = (msg) => {
        if (msg.type === 'chat') {
            if (msg.sender !== authState.user.username) {
                SoundManager.playMessage();
                if (onUnreadMessage) onUnreadMessage();

                // @Mention detection
                const myUsername = authState.user?.username || '';
                const isMentioned = myUsername && msg.text && msg.text.toLowerCase().includes(`@${myUsername.toLowerCase()}`);

                if (isMentioned) {
                    SoundManager.playMention();
                    if (window.SAFEZONE_API?.notify) {
                        window.SAFEZONE_API.notify(
                            `@${msg.sender} seni mention etti`,
                            msg.text.length > 80 ? msg.text.slice(0, 80) + '…' : msg.text
                        );
                    }
                } else {
                    // General message notification (if not focused)
                    if (window.SAFEZONE_API?.notify && document.hidden) {
                        window.SAFEZONE_API.notify(
                            `Yeni mesaj: ${msg.sender}`,
                            msg.text.length > 80 ? msg.text.slice(0, 80) + '…' : msg.text
                        );
                    }
                }
            }
            setMessages(prev => [...prev, {
                sender: msg.sender,
                text: msg.text,
                attachment_url: msg.attachment_url,
                attachment_type: msg.attachment_type,
                attachment_name: msg.attachment_name,
                timestamp: new Date().toISOString(),
                _new: true // flag for animation
            }]);
        } else if (msg.type === 'history') {
            const msgs = msg.messages || [];
            setMessages(msgs);
            setHasMore(msgs.length >= PAGE_SIZE);
        } else if (msg.type === 'typing') {
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.add(msg.sender);
                if (typingTimeouts.current[msg.sender]) clearTimeout(typingTimeouts.current[msg.sender]);
                typingTimeouts.current[msg.sender] = setTimeout(() => {
                    setTypingUsers(current => { const u = new Set(current); u.delete(msg.sender); return u; });
                    delete typingTimeouts.current[msg.sender];
                }, 3000);
                return newSet;
            });
        } else if (msg.type === 'message_deleted') {
            setMessages(prev => prev.filter(m => m.id !== msg.message_id));
        } else if (msg.type === 'message_react') {
            setMessages(prev => prev.map(m => {
                if (m.id === msg.message_id) {
                    return { ...m, reactions: msg.reactions };
                }
                return m;
            }));
        }
    }

    const fetchChannelMessages = async (channelId) => {
        if (!authState.token) return;
        currentChannelId.current = channelId;
        try {
            const res = await fetch(`${getUrl(`/channel/${channelId}/messages`)}?token=${authState.token}&limit=${PAGE_SIZE}`);
            const data = await res.json();
            if (data.status === 'success') {
                setMessages(data.messages);
                setHasMore(data.messages.length >= PAGE_SIZE);
            }
        } catch (e) { console.error(e); }
    }

    // Infinite scroll: load older messages
    const loadMoreMessages = async () => {
        const channelId = currentChannelId.current;
        if (!channelId || isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const firstMsg = messages[0];
            const beforeId = firstMsg?.id;
            const url = `${getUrl(`/channel/${channelId}/messages`)}?token=${authState.token}&limit=${PAGE_SIZE}${beforeId ? `&before_id=${beforeId}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success' && data.messages.length > 0) {
                setMessages(prev => [...data.messages, ...prev]);
                setHasMore(data.messages.length >= PAGE_SIZE);
            } else {
                setHasMore(false);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoadingMore(false); }
    }

    // --- ACTIONS ---
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('token', authState.token);
        formData.append('file', file);

        try {
            const res = await fetch(getUrl('/chat/upload'), { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') {
                setAttachment(data);
            } else {
                toast.error("Yükleme başarısız: " + data.message);
            }
        } catch (err) {
            console.error(err);
            toast.error("Dosya yükleme hatası!");
        } finally {
            setIsUploading(false);
        }
    }

    const handleTyping = (e) => {
        setInputText(e.target.value);
        const now = Date.now();
        if (now - lastTypingTimeRef.current > 2000) {
            const msg = { type: 'typing', sender: authState.user.username };
            if (chatWs.current?.readyState === WebSocket.OPEN) chatWs.current.send(JSON.stringify(msg));
            else if (roomWs.current?.readyState === WebSocket.OPEN) roomWs.current.send(JSON.stringify(msg));
            lastTypingTimeRef.current = now;
        }
    }

    const sendChatMessage = (text = inputText, replyToId = null) => {
        if (!text && !attachment) return;

        const msg = {
            type: 'chat',
            text: text,
            sender: authState.user.username,
            uuid: authState.user?.username || uuid.current,
            attachment_url: attachment?.url,
            attachment_type: attachment?.type,
            attachment_name: attachment?.name,
            reply_to_id: replyToId
        }

        if (chatWs.current && chatWs.current.readyState === WebSocket.OPEN) {
            chatWs.current.send(JSON.stringify(msg))
        } else if (roomWs.current && roomWs.current.readyState === WebSocket.OPEN) {
            roomWs.current.send(JSON.stringify(msg))
        }

        setInputText("");
        setAttachment(null);
    }

    // --- EDIT / DELETE ---
    const handleMessageContextMenu = (e, msg) => {
        if (msg.sender !== authState.user.username && !authState.user.is_sysadmin) return;
        e.preventDefault();
        setMessageContextMenu({ x: e.pageX, y: e.pageY, msg });
    }

    const handleDeleteMessage = async () => {
        if (!messageContextMenu) return;
        const msgId = messageContextMenu.msg.id;
        try {
            await fetch(getUrl('/message/delete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, message_id: msgId })
            });
            setMessages(prev => prev.filter(m => m.id !== msgId));
            setMessageContextMenu(null);
        } catch (e) { console.error(e); }
    }

    const startEditing = () => {
        setEditingMessageId(messageContextMenu.msg.id);
        setEditText(messageContextMenu.msg.content || messageContextMenu.msg.text || "");
        setMessageContextMenu(null);
    }

    const submitEdit = async () => {
        try {
            await fetch(getUrl('/message/edit'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authState.token, message_id: editingMessageId, content: editText })
            });
            setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editText, text: editText } : m));
            setEditingMessageId(null);
        } catch (e) { console.error(e); }
    }

    return {
        messages, setMessages,
        inputText, setInputText,
        attachment, setAttachment,
        isUploading,
        typingUsers,
        messageContextMenu, setMessageContextMenu,
        editingMessageId, setEditingMessageId,
        editText, setEditText,

        // Infinite scroll
        hasMore,
        isLoadingMore,
        loadMoreMessages,

        connectToChannel,
        fetchChannelMessages,
        handleIncomingMessage,

        handleFileSelect,
        handleTyping,
        sendChatMessage,
        handleDeleteMessage,
        handleMessageContextMenu,
        startEditing,
        submitEdit
    };
}
