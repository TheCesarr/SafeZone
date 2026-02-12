import { useState, useRef, useEffect } from 'react';
import { getUrl } from '../utils/api';
import SoundManager from '../utils/SoundManager';
import toast from '../utils/toast';

// v2: Added connectToChannel and message handling
export const useChat = (authState, uuid, chatWs, roomWs, onUnreadMessage) => {
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

    // --- CONNECTION ---
    const connectToChannel = (channel) => {
        if (!channel || channel.type === 'voice') return; // Voice handles its own chat in roomWs (mostly)

        if (chatWs.current) chatWs.current.close();
        const wsUrl = getUrl(`/ws/room/${channel.id}/${uuid.current}`, 'ws');
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
            }
            setMessages(prev => [...prev, {
                sender: msg.sender,
                text: msg.text,
                attachment_url: msg.attachment_url,
                attachment_type: msg.attachment_type,
                attachment_name: msg.attachment_name,
                timestamp: new Date().toISOString()
            }]);
        } else if (msg.type === 'history') {
            setMessages(msg.messages || []);
        } else if (msg.type === 'typing') {
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.add(msg.sender);

                // Clear existing timeout for this user
                if (typingTimeouts.current[msg.sender]) {
                    clearTimeout(typingTimeouts.current[msg.sender]);
                }

                // Set new timeout
                typingTimeouts.current[msg.sender] = setTimeout(() => {
                    setTypingUsers(current => {
                        const updated = new Set(current);
                        updated.delete(msg.sender);
                        return updated;
                    });
                    delete typingTimeouts.current[msg.sender];
                }, 3000);

                return newSet;
            });
        }
    }

    const fetchChannelMessages = async (channelId) => {
        if (!authState.token) return;
        try {
            const res = await fetch(`${getUrl(`/channel/${channelId}/messages`)}?token=${authState.token}`);
            const data = await res.json();
            if (data.status === 'success') {
                setMessages(data.messages);
            }
        } catch (e) { console.error(e); }
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

    const sendChatMessage = () => {
        if (!inputText && !attachment) return;

        const msg = {
            type: 'chat',
            text: inputText,
            sender: authState.user.username,
            uuid: uuid.current,
            attachment_url: attachment?.url,
            attachment_type: attachment?.type,
            attachment_name: attachment?.name
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
        setMessageContextMenu(null); // Close menu
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

        connectToChannel,
        fetchChannelMessages,
        handleIncomingMessage, // Expose for useWebRTC

        handleFileSelect,
        handleTyping,
        sendChatMessage,
        handleDeleteMessage,
        handleMessageContextMenu,
        startEditing,
        submitEdit
    };
}
