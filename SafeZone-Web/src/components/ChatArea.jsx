import React, { useRef, useCallback } from 'react';
import { getUrl } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import { MessageContextMenu, UserContextMenu } from './ContextMenus';
import MediaEmbed from './MediaEmbed';
import ProfileCard from './ProfileCard';
import { PERMISSIONS, hasPermission } from '../utils/permissions';

const ChatArea = ({
    selectedChannel,
    selectedDM,
    messages,
    dmHistory,
    currentUser,
    inputText,
    setInputText,
    onSendMessage,
    onSendDM,
    handleTyping,
    typingUsers,
    attachment,
    setAttachment,
    isUploading,
    handleFileSelect,
    editingMessageId,
    setEditingMessageId,
    editText,
    setEditText,
    submitEdit,
    handleMessageContextMenu,
    onlineMembers = [],
    colors = {},
    loadMoreMessages,   // infinite scroll callback
    hasMore = false,    // are there older messages?
    isLoadingMore = false,
    serverMembers = [], // for role color lookup
    replyingTo = null,
    setReplyingTo,
    activeEmojiPickerId = null,
    setActiveEmojiPickerId,
    emojiPickerPosition = null,
    setEmojiPickerPosition,
    authToken = null,
    setMessages,
    serverRoles = [],
    selectedServer = null,
    myPermissions = undefined,
    onRoleToggled = null
}) => {
    const currentMessages = (selectedDM ? dmHistory : messages) || [];
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const [mentionQuery, setMentionQuery] = React.useState(null);
    const [mentionSuggestions, setMentionSuggestions] = React.useState([]);
    const [selectedUserForProfile, setSelectedUserForProfile] = React.useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const prevScrollHeight = useRef(0);
    // --- Search ---
    const [showSearch, setShowSearch] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [searchResults, setSearchResults] = React.useState([]);
    const [searchLoading, setSearchLoading] = React.useState(false);
    // --- Pins ---
    const [showPins, setShowPins] = React.useState(false);
    const [pinnedMessages, setPinnedMessages] = React.useState([]);
    const [pinsLoading, setPinsLoading] = React.useState(false);

    const canSendMessages = !selectedChannel || selectedDM || (myPermissions !== undefined ? hasPermission(myPermissions, PERMISSIONS.SEND_MESSAGES) : false);
    const canAttachFiles = !selectedChannel || selectedDM || (myPermissions !== undefined ? hasPermission(myPermissions, PERMISSIONS.ATTACH_FILES) : false);

    // Close emoji picker on outside click
    React.useEffect(() => {
        if (!showEmojiPicker) return;
        const handler = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmojiPicker]);

    // Emoji text shortcut map
    const EMOJI_SHORTCUTS = {
        ':)': '😊', ':-)': '😊', ':D': '😁', ':-D': '😁',
        ':P': '😛', ':-P': '😛', ';)': '😉', ';-)': '😉',
        ':o': '😮', ':-o': '😮', ':O': '😮',
        ':(': '😢', ':-(': '😢', ":'(": '😭',
        ':|\'': '😐', ':|': '😐', ':-|': '😐',
        '>:(': '😠', '>:-(': '😠',
        '<3': '❤️', '</3': '💔',
        ':*': '😘', ':-*': '😘',
        'B)': '😎', 'B-)': '😎',
        ':+1:': '👍', ':-1:': '👎',
        ':fire:': '🔥', ':ok:': '👌', ':wave:': '👋',
        ':100:': '💯', ':star:': '⭐', ':heart:': '❤️',
        ':laugh:': '😂', ':cry:': '😭', ':wow:': '😮',
        ':angry:': '😡', ':cool:': '😎', ':wink:': '😉',
    };

    const replaceEmojiShortcuts = (text) => {
        // Replace patterns that end with a space or end of string
        let result = text;
        const sorted = Object.keys(EMOJI_SHORTCUTS).sort((a, b) => b.length - a.length);
        for (const shortcut of sorted) {
            // Only replace when followed by space or at end
            const escaped = shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<=[^\\S]|^)(${escaped})(?=\\s|$)`, 'g');
            result = result.replace(regex, EMOJI_SHORTCUTS[shortcut]);
        }
        return result;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    // Scroll bottom on new incoming messages (but not when loading older)
    const prevMsgCount = useRef(0);
    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        // Only scroll to bottom if near bottom or first load
        if (isNearBottom || prevMsgCount.current === 0) {
            scrollToBottom();
        } else if (currentMessages.length > prevMsgCount.current) {
            // Older messages loaded: restore scroll position
            const added = currentMessages.length - prevMsgCount.current;
            container.scrollTop = container.scrollHeight - prevScrollHeight.current;
        }
        prevMsgCount.current = currentMessages.length;
    }, [currentMessages, typingUsers]);

    // Infinite scroll: detect scroll to top
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (container.scrollTop < 80 && hasMore && !isLoadingMore && loadMoreMessages) {
            prevScrollHeight.current = container.scrollHeight;
            loadMoreMessages();
        }
    }, [hasMore, isLoadingMore, loadMoreMessages]);

    // Role color helper
    const getRoleColor = useCallback((username) => {
        const member = serverMembers.find(m => m.username === username);
        return member?.role_color || null;
    }, [serverMembers]);

    // --- Search Handler ---
    const handleSearch = React.useCallback(async (q) => {
        if (!q || q.length < 2 || !selectedChannel || !authToken) return;
        setSearchLoading(true);
        try {
            const res = await fetch(getUrl(`/channel/${selectedChannel.id}/messages/search?token=${authToken}&q=${encodeURIComponent(q)}&limit=30`));
            const data = await res.json();
            if (data.status === 'success') setSearchResults(data.results || []);
        } catch (e) { console.error(e); }
        finally { setSearchLoading(false); }
    }, [selectedChannel, authToken]);

    // --- Pin Handler ---
    const handlePin = React.useCallback(async (msg) => {
        if (!authToken || !selectedChannel) return;
        const isPinned = msg.is_pinned;
        const endpoint = isPinned
            ? `/message/${msg.id}/unpin?token=${authToken}`
            : `/message/${msg.id}/pin?token=${authToken}&channel_id=${selectedChannel.id}`;
        try {
            const res = await fetch(getUrl(endpoint), { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setMessages && setMessages(prev => prev.map(m =>
                    m.id === msg.id ? { ...m, is_pinned: !isPinned } : m
                ));
                if (showPins) fetchPins();
            }
        } catch (e) { console.error(e); }
    }, [authToken, selectedChannel, setMessages, showPins]);


    const fetchPins = React.useCallback(async () => {
        if (!selectedChannel || !authToken) return;
        setPinsLoading(true);
        try {
            const res = await fetch(getUrl(`/channel/${selectedChannel.id}/pins?token=${authToken}`));
            const data = await res.json();
            if (data.status === 'success') setPinnedMessages(data.pins || []);
        } catch (e) { console.error(e); }
        finally { setPinsLoading(false); }
    }, [selectedChannel, authToken]);

    React.useEffect(() => { if (showPins) fetchPins(); }, [showPins, selectedChannel]);

    // --- Reaction Handler ---
    const handleReaction = React.useCallback(async (msgId, emoji, currentReactions) => {
        if (!authToken) return;
        const myName = currentUser?.username;
        const hasReacted = currentReactions[emoji]?.includes(myName);
        const method = hasReacted ? 'DELETE' : 'POST';
        try {
            const res = await fetch(getUrl(`/message/${msgId}/react?token=${authToken}&emoji=${encodeURIComponent(emoji)}`), { method });
            const data = await res.json();
            if (data.status === 'success') {
                // Optimistic update
                setMessages && setMessages(prev => prev.map(m => {
                    if (m.id !== msgId) return m;
                    const updatedReactions = { ...m.reactions };
                    if (hasReacted) {
                        updatedReactions[emoji] = (updatedReactions[emoji] || []).filter(u => u !== myName);
                        if (!updatedReactions[emoji].length) delete updatedReactions[emoji];
                    } else {
                        updatedReactions[emoji] = [...(updatedReactions[emoji] || []), myName];
                    }
                    return { ...m, reactions: updatedReactions };
                }));
            }
        } catch (e) { console.error(e); }
    }, [authToken, currentUser, setMessages]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

            {/* 🔍 Search / 📌 Pin toolbar buttons — only in server text channels */}
            {selectedChannel && !selectedDM && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', padding: '4px 16px', background: 'transparent', borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.05)'}` }}>
                    <button
                        title="Mesaj Ara"
                        onClick={() => { setShowSearch(s => !s); setShowPins(false); }}
                        style={{ background: showSearch ? (colors?.accent || '#5865F2') : 'transparent', border: 'none', color: showSearch ? '#fff' : (colors?.textMuted || '#888'), cursor: 'pointer', padding: '4px 10px', borderRadius: '4px', fontSize: '14px', transition: 'all 0.15s' }}
                    >🔍 Ara</button>
                    <button
                        title="Sabitlenen Mesajlar"
                        onClick={() => { setShowPins(s => !s); setShowSearch(false); }}
                        style={{ background: showPins ? '#FAA61A' : 'transparent', border: 'none', color: showPins ? '#fff' : (colors?.textMuted || '#888'), cursor: 'pointer', padding: '4px 10px', borderRadius: '4px', fontSize: '14px', transition: 'all 0.15s' }}
                    >📌 Sabitlenenler</button>
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* ─── left: Main chat scroll ─── */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    style={{ flexGrow: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}
                >
                    {/* Infinite scroll loading indicator */}
                    {isLoadingMore && (
                        <div style={{ textAlign: 'center', padding: '8px', color: colors?.textMuted || '#888', fontSize: '12px' }}>
                            ⏳ Eski mesajlar yükleniyor...
                        </div>
                    )}
                    {hasMore && !isLoadingMore && (
                        <div style={{ textAlign: 'center', padding: '4px', color: colors?.textMuted || '#666', fontSize: '11px' }}>
                            ↑ Daha fazla mesaj için yukarı kaydırın
                        </div>
                    )}
                    {currentMessages.map((msg, i) => {
                        const sender = typeof msg === 'string' ? msg.split(': ')[0] : (selectedDM ? msg.sender : msg.sender);
                        const text = (typeof msg === 'string' ? msg.split(': ').slice(1).join(': ') : (selectedDM ? msg.content : (msg.content || msg.text))) || "";
                        const isMe = sender === currentUser.username;
                        const isMentioned = !isMe && text.toLowerCase().includes(`@${currentUser.username.toLowerCase()}`);

                        // Group consecutive messages from the same sender
                        const prevMsg = currentMessages[i - 1];
                        const prevSender = prevMsg ? (typeof prevMsg === 'string' ? prevMsg.split(': ')[0] : prevMsg.sender) : null;
                        const isGrouped = prevSender === sender && !msg.reply_to;

                        return (
                            <div
                                key={i}
                                className="message-row"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    paddingTop: isGrouped ? '2px' : '10px',
                                    marginTop: isGrouped ? 0 : '4px',
                                    // @Mention highlight
                                    ...(isMentioned ? {
                                        background: 'rgba(250, 166, 26, 0.08)',
                                        borderLeft: '3px solid #FAA61A',
                                        paddingLeft: '8px',
                                        marginLeft: '-11px',
                                        borderRadius: '0 4px 4px 0',
                                    } : {})
                                }}
                            >
                                {/* --- OPTIONAL REPLY CONTEXT BANNER (ABOVE MESSAGE) --- */}
                                {msg.reply_to && msg.reply_to.sender && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginBottom: '4px',
                                        color: colors?.textMuted || '#b5bac1',
                                        fontSize: '13px',
                                        position: 'relative',
                                        paddingLeft: '50px',
                                        marginTop: '-4px'
                                    }}>
                                        {/* L-Shaped curve pointing to reply */}
                                        <div style={{
                                            position: 'absolute',
                                            left: '18px',
                                            top: '50%',
                                            width: '24px',
                                            height: '14px',
                                            borderLeft: `2px solid ${colors?.border || '#4f545c'}`,
                                            borderTop: `2px solid ${colors?.border || '#4f545c'}`,
                                            borderTopLeftRadius: '6px',
                                            transform: 'translateY(-6px)'
                                        }}></div>

                                        {/* Reply Avatar Mini */}
                                        <div style={{
                                            width: '16px', height: '16px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0
                                        }}>
                                            {(() => {
                                                const rm = serverMembers.find(m => m.username === msg.reply_to.sender);
                                                if (rm && rm.avatar_url) return <img src={getUrl(rm.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                                return <div style={{ width: '100%', height: '100%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff' }}>{msg.reply_to.sender.slice(0, 2).toUpperCase()}</div>;
                                            })()}
                                        </div>

                                        <span style={{ fontWeight: 600, color: getRoleColor(msg.reply_to.sender) || (colors?.text || '#f2f3f5'), cursor: 'pointer' }}>
                                            @{msg.reply_to.sender}
                                        </span>
                                        <span style={{
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '400px',
                                            cursor: 'pointer',
                                            opacity: 0.8
                                        }}
                                            title="Mesaja git"
                                        >
                                            {msg.reply_to.text}
                                        </span>
                                    </div>
                                )}

                                {/* Main message row with avatar and text */}
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    {/* Avatar: show only for first message in group */}
                                    <div style={{ width: '38px', flexShrink: 0 }}>
                                        {!isGrouped && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const member = serverMembers.find(m => m.username === sender) || { username: sender };
                                                    setSelectedUserForProfile({
                                                        user: {
                                                            username: sender,
                                                            display_name: member.display_name,
                                                            avatar_url: member.avatar_url,
                                                            avatar_color: member.avatar_color || (isMe ? '#3ba55c' : '#5865F2'),
                                                            status: member.status || 'offline',
                                                            role_color: member.role_color,
                                                            highest_role: member.highest_role,
                                                            custom_status: member.custom_status,
                                                            is_sysadmin: member.is_sysadmin
                                                        },
                                                        rect: e.currentTarget.getBoundingClientRect()
                                                    });
                                                }}
                                                style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    borderRadius: '50%',
                                                    background: `linear-gradient(135deg, ${isMe ? '#3ba55c' : '#5865F2'}, ${isMe ? '#2d8049' : '#4752c4'})`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#fff',
                                                    letterSpacing: '0.5px',
                                                    cursor: 'pointer',
                                                    overflow: 'hidden'
                                                }}>
                                                {(() => {
                                                    const member = serverMembers.find(m => m.username === sender);
                                                    if (member && member.avatar_url) return <img src={getUrl(member.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                                    return sender.slice(0, 2).toUpperCase();
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                                        {!isGrouped && (
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const member = serverMembers.find(m => m.username === sender) || { username: sender };
                                                        setSelectedUserForProfile({
                                                            user: {
                                                                username: sender,
                                                                display_name: member.display_name,
                                                                avatar_url: member.avatar_url,
                                                                avatar_color: member.avatar_color || (isMe ? '#3ba55c' : '#5865F2'),
                                                                status: member.status || 'offline',
                                                                role_color: member.role_color,
                                                                highest_role: member.highest_role,
                                                                custom_status: member.custom_status,
                                                                is_sysadmin: member.is_sysadmin
                                                            },
                                                            rect: e.currentTarget.getBoundingClientRect()
                                                        });
                                                    }}
                                                    style={{
                                                        fontWeight: '600',
                                                        fontSize: '15px',
                                                        color: getRoleColor(sender) || (isMe ? '#3ba55c' : (colors?.text || '#fff')),
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {sender}
                                                </span>
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: colors?.textMuted || '#72767d',
                                                    fontWeight: '400',
                                                }}>
                                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        )}

                                        {editingMessageId === msg.id ? (
                                            <div style={{ marginTop: '4px' }}>
                                                <input
                                                    value={editText || ""}
                                                    onChange={e => setEditText(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') submitEdit();
                                                        if (e.key === 'Escape') setEditingMessageId(null);
                                                    }}
                                                    autoFocus
                                                    style={{
                                                        width: '100%',
                                                        background: colors?.card || '#40444b',
                                                        border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`,
                                                        borderRadius: '6px',
                                                        padding: '8px 12px',
                                                        color: colors?.text || '#dcddde',
                                                        outline: 'none',
                                                        fontSize: '14px',
                                                    }}
                                                />
                                                <div style={{ fontSize: '11px', marginTop: '4px', color: colors?.textMuted || '#b9bbbe' }}>
                                                    Vazgeçmek için <span style={{ color: colors?.accent || '#00b0f4', fontWeight: '500' }}>ESC</span>, kaydetmek için <span style={{ color: colors?.accent || '#00b0f4', fontWeight: '500' }}>Enter</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>

                                                <div
                                                    style={{
                                                        color: colors?.text || '#dcddde',
                                                        marginTop: isGrouped ? 0 : '2px',
                                                        cursor: 'context-menu',
                                                        fontSize: '14px',
                                                        lineHeight: '1.45',
                                                    }}
                                                    onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                                                >
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                                                            a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: colors?.accent || '#00b0f4', textDecoration: 'none' }}>{children}</a>,
                                                            code: ({ inline, children }) => (
                                                                <code style={{
                                                                    background: 'rgba(0,0,0,0.3)',
                                                                    padding: '1px 5px',
                                                                    borderRadius: '3px',
                                                                    fontFamily: '"JetBrains Mono", monospace',
                                                                    fontSize: '0.88em'
                                                                }}>
                                                                    {children}
                                                                </code>
                                                            ),
                                                            pre: ({ children }) => (
                                                                <pre style={{
                                                                    background: 'rgba(0,0,0,0.25)',
                                                                    padding: '12px',
                                                                    borderRadius: '6px',
                                                                    overflowX: 'auto',
                                                                    margin: '6px 0',
                                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                                }}>
                                                                    {children}
                                                                </pre>
                                                            ),
                                                            text: ({ node, children }) => {
                                                                if (typeof children !== 'string') return children;
                                                                const mentionRegex = /@([a-zA-Z0-9_ğüşöçİĞÜŞÖÇ]+)/g;
                                                                const parts = children.split(mentionRegex);
                                                                if (parts.length === 1) return children;

                                                                return (
                                                                    <>
                                                                        {parts.map((part, i) => {
                                                                            if (i % 2 === 1) { // Captured group (username)
                                                                                const isMeMention = part === currentUser.username;
                                                                                return (
                                                                                    <span
                                                                                        key={i}
                                                                                        style={{
                                                                                            background: isMeMention ? 'rgba(250, 166, 26, 0.2)' : 'rgba(88, 101, 242, 0.3)',
                                                                                            color: isMeMention ? '#FAA61A' : '#c9cdfb',
                                                                                            padding: '0 4px',
                                                                                            borderRadius: '3px',
                                                                                            fontWeight: '500',
                                                                                            cursor: 'pointer'
                                                                                        }}
                                                                                    >
                                                                                        @{part}
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return part;
                                                                        })}
                                                                    </>
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        {text}
                                                    </ReactMarkdown>
                                                    {msg.edited_at && <span style={{ fontSize: '10px', color: '#72767d', marginLeft: '5px' }}>(düzenlendi)</span>}
                                                </div>
                                            </div>
                                        )}

                                        {msg.attachment_url && (
                                            <div style={{ marginTop: '6px' }}>
                                                {msg.attachment_type === 'image' ? (
                                                    <img
                                                        src={getUrl(msg.attachment_url)}
                                                        alt="attachment"
                                                        style={{
                                                            maxWidth: '350px',
                                                            maxHeight: '300px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                            transition: 'transform 0.2s',
                                                        }}
                                                        onClick={() => window.open(getUrl(msg.attachment_url), '_blank')}
                                                        onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
                                                        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                                    />
                                                ) : msg.attachment_type === 'video' ? (
                                                    <video src={getUrl(msg.attachment_url)} controls style={{ maxWidth: '350px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }} />
                                                ) : (
                                                    <a href={getUrl(msg.attachment_url)} target="_blank" rel="noreferrer" style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        background: colors?.card || '#2f3136',
                                                        padding: '10px 14px',
                                                        borderRadius: '6px',
                                                        maxWidth: '300px',
                                                        textDecoration: 'none',
                                                        color: '#00b0f4',
                                                        border: `1px solid ${colors?.border || 'rgba(255,255,255,0.06)'}`,
                                                        transition: 'background 0.15s',
                                                    }}>
                                                        📁 {msg.attachment_name || 'Dosya'}
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {(() => {
                                            const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
                                            if (urlMatch && !msg.attachment_url) {
                                                return <MediaEmbed url={urlMatch[0]} />;
                                            }
                                            return null;
                                        })()}

                                        {/* Reactions Bar */}
                                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                {Object.entries(msg.reactions).map(([emoji, userUuids]) => {
                                                    if (!userUuids.length) return null;
                                                    const hasReacted = userUuids.includes(currentUser.uuid || currentUser.username);
                                                    return (
                                                        <div
                                                            key={emoji}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    const res = await fetch(getUrl('/message/react'), {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ token: authToken, message_id: msg.id, emoji })
                                                                    });
                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        if (data.reactions !== undefined) {
                                                                            // Optimistically update local state immediately
                                                                            const msgId = msg.id;
                                                                            window.__szSetMessages && window.__szSetMessages(prev => prev.map(m =>
                                                                                m.id === msgId ? { ...m, reactions: data.reactions } : m
                                                                            ));
                                                                        }
                                                                    }
                                                                } catch (err) { console.error(err); }
                                                            }}
                                                            style={{
                                                                background: hasReacted ? 'rgba(88, 101, 242, 0.15)' : (colors?.card || '#2b2d31'),
                                                                border: `1px solid ${hasReacted ? '#5865F2' : 'transparent'}`,
                                                                borderRadius: '8px',
                                                                padding: '2px 8px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '1rem',
                                                                userSelect: 'none',
                                                                transition: 'transform 0.1s, background 0.1s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; if (!hasReacted) e.currentTarget.style.background = '#313338'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; if (!hasReacted) e.currentTarget.style.background = (colors?.card || '#2b2d31'); }}
                                                            title={`${userUuids.length} kişi tepki bıraktı`}
                                                        >
                                                            <span style={{ display: 'flex', alignItems: 'center', fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}>{emoji}</span>
                                                            <span style={{ color: hasReacted ? '#fff' : '#b5bac1', fontWeight: 600, fontSize: '12px' }}>{userUuids.length}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* ─── Search Results Sidebar ─── */}
                {showSearch && (
                    <div style={{ width: '320px', flexShrink: 0, background: colors?.card || '#1e1f22', borderLeft: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`, display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                autoFocus
                                placeholder="Mesajlarda ara..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
                                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', padding: '8px 12px', color: colors?.text || '#fff', fontSize: '14px', outline: 'none' }}
                            />
                            <button onClick={() => handleSearch(searchQuery)} disabled={searchLoading} style={{ background: colors?.accent || '#5865F2', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                {searchLoading ? '...' : 'Ara'}
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {searchResults.length === 0 && !searchLoading && searchQuery.length > 1 && (
                                <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>Sonuç bulunamadı</div>
                            )}
                            {searchResults.map(r => {
                                const highlightText = (text, q) => {
                                    if (!q) return text;
                                    const idx = text.toLowerCase().indexOf(q.toLowerCase());
                                    if (idx === -1) return text;
                                    return <>{text.slice(0, idx)}<mark style={{ background: '#FAA61A33', color: '#FAA61A', borderRadius: '2px', padding: '0 2px' }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
                                };
                                return (
                                    <div key={r.id} style={{ padding: '10px', borderRadius: '6px', marginBottom: '6px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.05)'}` }}>
                                        <div style={{ fontSize: '12px', color: colors?.accent || '#5865F2', fontWeight: 600, marginBottom: '4px' }}>{r.sender}</div>
                                        <div style={{ fontSize: '13px', color: colors?.text || '#ddd', lineHeight: 1.4 }}>{highlightText(r.text, searchQuery)}</div>
                                        <div style={{ fontSize: '10px', color: colors?.textMuted || '#666', marginTop: '4px' }}>{new Date(r.timestamp).toLocaleString('tr-TR')}</div>
                                        {r.is_pinned && <div style={{ fontSize: '10px', color: '#FAA61A', marginTop: '2px' }}>📌 Sabitlenmiş</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Pinned Messages Sidebar ─── */}
                {showPins && (
                    <div style={{ width: '320px', flexShrink: 0, background: colors?.card || '#1e1f22', borderLeft: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`, fontWeight: 700, color: colors?.text || '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📌 Sabitlenmiş Mesajlar
                            <button onClick={() => setShowPins(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: colors?.textMuted || '#888', cursor: 'pointer', fontSize: '16px' }}>×</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {pinsLoading && <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>Yükleniyor...</div>}
                            {!pinsLoading && pinnedMessages.length === 0 && (
                                <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>📌 Sabitlenmiş mesaj yok</div>
                            )}
                            {pinnedMessages.map(pin => (
                                <div key={pin.id} style={{ padding: '10px', borderRadius: '6px', marginBottom: '6px', background: 'rgba(0,0,0,0.2)', border: `1px solid rgba(250,166,26,0.2)` }}>
                                    <div style={{ fontSize: '12px', color: '#FAA61A', fontWeight: 600, marginBottom: '4px' }}>📌 {pin.sender}</div>
                                    <div style={{ fontSize: '13px', color: colors?.text || '#ddd', lineHeight: 1.4 }}>{pin.content || pin.text}</div>
                                    <div style={{ fontSize: '10px', color: colors?.textMuted || '#666', marginTop: '4px' }}>{new Date(pin.timestamp).toLocaleString('tr-TR')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div> {/* end flex row */}
            {activeEmojiPickerId && emojiPickerPosition && (
                <>
                    <div onClick={() => setActiveEmojiPickerId(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20001 }} />
                    <div style={{ position: 'fixed', top: emojiPickerPosition.y - 100, left: emojiPickerPosition.x + 120, zIndex: 20002, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                        <EmojiPicker
                            theme="dark"
                            onEmojiClick={(emojiObj) => {
                                const msgId = activeEmojiPickerId;
                                const currentMsg = (messages || []).find(m => m.id === msgId);
                                setActiveEmojiPickerId(null);
                                handleReaction(msgId, emojiObj.emoji, currentMsg?.reactions || {});
                            }}

                        />
                    </div>
                </>
            )}

            {/* Attachment Preview */}
            {attachment && (
                <div style={{
                    background: colors?.card || 'rgba(255,255,255,0.04)',
                    padding: '8px 14px',
                    margin: '0 20px 6px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    border: `1px solid ${colors?.border || 'rgba(255,255,255,0.08)'}`,
                    backdropFilter: 'blur(8px)',
                }}>
                    <span style={{ fontSize: '18px', marginRight: '8px' }}>📎</span>
                    <span style={{ flexGrow: 1, color: colors?.text || '#fff', fontSize: '13px' }}>
                        {attachment.name} <span style={{ color: colors?.textMuted || '#72767d' }}>({attachment.type})</span>
                    </span>
                    <button onClick={() => setAttachment(null)} style={{
                        background: 'none',
                        border: 'none',
                        color: '#ed4245',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'background 0.15s',
                    }}
                        onMouseEnter={e => e.target.style.background = 'rgba(237,66,69,0.1)'}
                        onMouseLeave={e => e.target.style.background = 'none'}
                    >✕</button>
                </div>
            )}

            {/* Replying To Banner */}
            {replyingTo && (
                <div style={{
                    background: '#2b2d31',
                    padding: '8px 12px 8px 16px',
                    margin: '0 20px',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    borderTop: `1px solid ${colors?.border || 'transparent'}`,
                    borderLeft: `1px solid ${colors?.border || 'transparent'}`,
                    borderRight: `1px solid ${colors?.border || 'transparent'}`,
                    position: 'relative',
                    top: '12px',
                    zIndex: 1
                }}>
                    <span style={{ color: '#b5bac1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                        <strong style={{ color: '#f2f3f5', fontWeight: 600 }}>{replyingTo.sender}</strong> kişisine yanıt veriliyor
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: '#00a8fc', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '14px' }}>@</span> AÇIK
                        </span>
                        <button onClick={() => setReplyingTo(null)} style={{
                            background: '#232428', border: 'none', color: '#b5bac1', cursor: 'pointer', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                            transition: 'color 0.15s'
                        }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#b5bac1'}>
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
                <div style={{
                    padding: '0 20px 4px 74px',
                    color: colors?.textMuted || '#b9bbbe',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    <span style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                    </span>
                    <span style={{ fontStyle: 'italic' }}>
                        {Array.from(typingUsers).join(', ')} yazıyor...
                    </span>
                </div>
            )}

            {/* Chat Input */}
            <div style={{
                padding: '12px 20px 16px',
                background: 'transparent',
                position: 'relative',
            }}>
                {/* @Mention Autocomplete Popup */}
                {mentionSuggestions.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '70px',
                        left: '20px',
                        right: '20px',
                        background: colors?.card || '#2f3136',
                        border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        zIndex: 100,
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
                    }}>
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: colors?.textMuted || '#72767d', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.06)'}` }}>Üyeler</div>
                        {mentionSuggestions.map(member => (
                            <div
                                key={member.username}
                                onClick={() => {
                                    const lastAt = inputText.lastIndexOf('@');
                                    const newText = inputText.slice(0, lastAt) + `@${member.username} `;
                                    setInputText(newText);
                                    setMentionSuggestions([]);
                                    setMentionQuery(null);
                                }}
                                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: colors?.text || '#fff', transition: 'background 0.1s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: member.avatar_color || '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
                                    {member.username.slice(0, 2).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: '500' }}>{member.display_name || member.username}</span>
                                <span style={{ fontSize: '11px', color: colors?.textMuted || '#72767d' }}>@{member.username}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="chat-input-wrapper" style={{ opacity: canSendMessages ? 1 : 0.6 }}>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} disabled={!canAttachFiles} />
                    {canAttachFiles && (
                        <span
                            onClick={() => { if (!isUploading && canAttachFiles) fileInputRef.current?.click() }}
                            style={{
                                cursor: 'pointer',
                                marginRight: '10px',
                                fontSize: '20px',
                                color: isUploading ? '#faa61a' : (colors?.textMuted || 'rgba(255,255,255,0.3)'),
                                transition: 'color 0.15s, transform 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px',
                                borderRadius: '4px',
                            }}
                            onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.target.style.color = isUploading ? '#faa61a' : (colors?.textMuted || 'rgba(255,255,255,0.3)'); e.target.style.transform = 'scale(1)'; }}
                            title="Dosya Yükle"
                        >
                            {isUploading ? '⏳' : '＋'}
                        </span>
                    )}
                    <input
                        className="chat-input"
                        type="text"
                        disabled={!canSendMessages}
                        placeholder={canSendMessages ? `Mesaj gönder: ${selectedDM ? '@' + selectedDM.username : (selectedChannel ? '#' + selectedChannel.name : '')}` : `Mesaj gönderme yetkiniz yok`}
                        value={inputText}
                        onChange={(e) => {
                            let val = e.target.value;
                            // Auto-replace emoji shortcuts when a space is typed after them
                            if (val.endsWith(' ')) {
                                val = replaceEmojiShortcuts(val);
                            }
                            setInputText(val);
                            handleTyping({ target: { value: val } });
                            // @mention autocomplete detection
                            const lastAt = val.lastIndexOf('@');
                            if (lastAt !== -1 && lastAt === val.length - 1) {
                                setMentionQuery('');
                                setMentionSuggestions(onlineMembers.filter(m => m.username !== currentUser.username));
                            } else if (lastAt !== -1) {
                                const query = val.slice(lastAt + 1).split(' ')[0];
                                if (!query.includes(' ')) {
                                    setMentionQuery(query);
                                    setMentionSuggestions(
                                        onlineMembers.filter(m =>
                                            m.username !== currentUser.username &&
                                            m.username.toLowerCase().startsWith(query.toLowerCase())
                                        )
                                    );
                                } else {
                                    setMentionSuggestions([]);
                                    setMentionQuery(null);
                                }
                            } else {
                                setMentionSuggestions([]);
                                setMentionQuery(null);
                            }
                        }}

                        onKeyDown={e => {
                            if (e.key === 'Escape') {
                                setMentionSuggestions([]);
                                setMentionQuery(null);
                                setShowEmojiPicker(false);
                                if (replyingTo) setReplyingTo(null);
                            }
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (mentionSuggestions.length > 0) {
                                    const member = mentionSuggestions[0];
                                    const lastAt = inputText.lastIndexOf('@');
                                    const newText = inputText.slice(0, lastAt) + `@${member.username} `;
                                    setInputText(newText);
                                    setMentionSuggestions([]);
                                    setMentionQuery(null);
                                    return;
                                }
                                if (inputText.trim() || attachment) {
                                    if (selectedDM) onSendDM();
                                    else {
                                        onSendMessage(inputText, replyingTo?.id);
                                        setReplyingTo(null);
                                    }
                                }
                            }
                        }}
                        style={{ color: colors?.text || '#fff' }}
                        ref={inputRef}
                    />

                    {/* Emoji Picker Button */}
                    <div ref={emojiPickerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span
                            onClick={() => setShowEmojiPicker(p => !p)}
                            title="Emoji"
                            style={{
                                cursor: 'pointer',
                                fontSize: '20px',
                                marginLeft: '8px',
                                color: showEmojiPicker ? (colors?.accent || '#5865F2') : (colors?.textMuted || 'rgba(255,255,255,0.3)'),
                                transition: 'color 0.15s, transform 0.15s',
                                userSelect: 'none',
                                lineHeight: 1,
                            }}
                            onMouseEnter={e => { e.target.style.color = colors?.accent || '#5865F2'; e.target.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.target.style.color = showEmojiPicker ? (colors?.accent || '#5865F2') : (colors?.textMuted || 'rgba(255,255,255,0.3)'); e.target.style.transform = 'scale(1)'; }}
                        >😊</span>

                        {showEmojiPicker && (
                            <div style={{
                                position: 'absolute',
                                bottom: '44px',
                                right: '0',
                                zIndex: 9999,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                            }}>
                                <EmojiPicker
                                    onEmojiClick={(emojiData) => {
                                        const emoji = emojiData.emoji;
                                        const el = inputRef.current;
                                        if (el) {
                                            const start = el.selectionStart ?? inputText.length;
                                            const end = el.selectionEnd ?? inputText.length;
                                            const newText = inputText.slice(0, start) + emoji + inputText.slice(end);
                                            setInputText(newText);
                                            // Restore focus and move cursor after emoji
                                            setTimeout(() => {
                                                el.focus();
                                                const pos = start + emoji.length;
                                                el.setSelectionRange(pos, pos);
                                            }, 0);
                                        } else {
                                            setInputText(prev => prev + emoji);
                                        }
                                        setShowEmojiPicker(false);
                                    }}
                                    theme={colors?.background?.startsWith('#f') ? 'light' : 'dark'}
                                    searchPlaceholder="Emoji ara..."
                                    height={380}
                                    width={320}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* User Profile Card Modal Overlay */}
            {selectedUserForProfile && (
                <ProfileCard
                    user={selectedUserForProfile.user}
                    rect={selectedUserForProfile.rect}
                    colors={colors}
                    serverRoles={serverRoles}
                    currentUser={currentUser}
                    selectedServer={selectedServer}
                    authToken={authToken}
                    onRoleToggled={onRoleToggled}
                    onClose={() => setSelectedUserForProfile(null)}
                />
            )}
        </div>
    );
};

export default ChatArea;
