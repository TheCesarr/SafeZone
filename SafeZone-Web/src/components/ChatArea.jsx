import React, { useRef, useCallback } from 'react';
import { getUrl } from '../utils/api';
import EmojiPicker from 'emoji-picker-react';
import ProfileCard from './ProfileCard';
import { PERMISSIONS, hasPermission } from '../utils/permissions';

// ── Sub-components ──────────────────────────────────────────────────────────
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import SearchPanel from './SearchPanel';
import PinnedMessages from './PinnedMessages';

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
    loadMoreMessages,
    hasMore = false,
    isLoadingMore = false,
    serverMembers = [],
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
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const prevScrollHeight = useRef(0);

    // --- Profile Card ---
    const [selectedUserForProfile, setSelectedUserForProfile] = React.useState(null);

    // --- Search ---
    const [showSearch, setShowSearch] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [searchResults, setSearchResults] = React.useState([]);
    const [searchLoading, setSearchLoading] = React.useState(false);

    // --- Pins ---
    const [showPins, setShowPins] = React.useState(false);
    const [pinnedMessages, setPinnedMessages] = React.useState([]);
    const [pinsLoading, setPinsLoading] = React.useState(false);

    // --- Edit History Modal ---
    const [editHistoryModal, setEditHistoryModal] = React.useState(null);

    // --- Permissions ---
    const canSendMessages = !selectedChannel || selectedDM || (myPermissions !== undefined ? hasPermission(myPermissions, PERMISSIONS.SEND_MESSAGES) : false);
    const canAttachFiles = !selectedChannel || selectedDM || (myPermissions !== undefined ? hasPermission(myPermissions, PERMISSIONS.ATTACH_FILES) : false);

    // --- Scroll Management ---
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const prevMsgCount = useRef(0);
    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom || prevMsgCount.current === 0) {
            scrollToBottom();
        } else if (currentMessages.length > prevMsgCount.current) {
            container.scrollTop = container.scrollHeight - prevScrollHeight.current;
        }
        prevMsgCount.current = currentMessages.length;
    }, [currentMessages, typingUsers]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (container.scrollTop < 80 && hasMore && !isLoadingMore && loadMoreMessages) {
            prevScrollHeight.current = container.scrollHeight;
            loadMoreMessages();
        }
    }, [hasMore, isLoadingMore, loadMoreMessages]);

    // --- Role color helper ---
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

    // --- Pin Handlers ---
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

            {/* 🔍 Search / 📌 Pin toolbar buttons */}
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
                {/* ─── Main chat scroll ─── */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    style={{ flexGrow: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}
                >
                    {isLoadingMore && (
                        <div style={{ textAlign: 'center', padding: '8px', color: colors?.textMuted || '#888', fontSize: '12px' }}>⏳ Eski mesajlar yükleniyor...</div>
                    )}
                    {hasMore && !isLoadingMore && (
                        <div style={{ textAlign: 'center', padding: '4px', color: colors?.textMuted || '#666', fontSize: '11px' }}>↑ Daha fazla mesaj için yukarı kaydırın</div>
                    )}

                    {currentMessages.map((msg, i) => {
                        const sender = typeof msg === 'string' ? msg.split(': ')[0] : msg.sender;
                        const text = (typeof msg === 'string' ? msg.split(': ').slice(1).join(': ') : (selectedDM ? msg.content : (msg.content || msg.text))) || "";
                        const isMe = sender === currentUser.username;
                        const isMentioned = !isMe && text.toLowerCase().includes(`@${currentUser.username.toLowerCase()}`);
                        const prevMsg = currentMessages[i - 1];
                        const prevSender = prevMsg ? (typeof prevMsg === 'string' ? prevMsg.split(': ')[0] : prevMsg.sender) : null;
                        const isGrouped = prevSender === sender && !msg.reply_to;

                        return (
                            <MessageBubble
                                key={msg.id || i}
                                msg={msg}
                                index={i}
                                prevMsg={prevMsg}
                                currentUser={currentUser}
                                isMe={isMe}
                                isGrouped={isGrouped}
                                isMentioned={isMentioned}
                                editingMessageId={editingMessageId}
                                editText={editText}
                                setEditText={setEditText}
                                setEditingMessageId={setEditingMessageId}
                                submitEdit={submitEdit}
                                handleMessageContextMenu={handleMessageContextMenu}
                                serverMembers={serverMembers}
                                getRoleColor={getRoleColor}
                                colors={colors}
                                authToken={authToken}
                                setMessages={setMessages}
                                setSelectedUserForProfile={setSelectedUserForProfile}
                                setEditHistoryModal={setEditHistoryModal}
                            />
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* ─── Search Results Sidebar ─── */}
                {showSearch && (
                    <SearchPanel
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        searchResults={searchResults}
                        searchLoading={searchLoading}
                        handleSearch={handleSearch}
                        colors={colors}
                    />
                )}

                {/* ─── Pinned Messages Sidebar ─── */}
                {showPins && (
                    <PinnedMessages
                        pinnedMessages={pinnedMessages}
                        pinsLoading={pinsLoading}
                        onClose={() => setShowPins(false)}
                        colors={colors}
                    />
                )}
            </div>

            {/* Reaction Emoji Picker (per-message) */}
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

            {/* ─── Chat Input Area ─── */}
            <ChatInput
                inputText={inputText}
                setInputText={setInputText}
                onSendMessage={onSendMessage}
                onSendDM={onSendDM}
                handleTyping={handleTyping}
                typingUsers={typingUsers}
                attachment={attachment}
                setAttachment={setAttachment}
                isUploading={isUploading}
                handleFileSelect={handleFileSelect}
                selectedChannel={selectedChannel}
                selectedDM={selectedDM}
                currentUser={currentUser}
                onlineMembers={onlineMembers}
                colors={colors}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                canSendMessages={canSendMessages}
                canAttachFiles={canAttachFiles}
            />

            {/* Edit History Modal */}
            {editHistoryModal && (
                <>
                    <div onClick={() => setEditHistoryModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 30000, backdropFilter: 'blur(2px)' }} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: colors?.card || '#1e1f22', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '0', zIndex: 30001, width: '480px', maxWidth: '90vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px' }}>📝</span>
                            <span style={{ fontWeight: 700, color: colors?.text || '#fff', fontSize: '15px' }}>Düzenleme Geçmişi</span>
                            <button onClick={() => setEditHistoryModal(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: colors?.textMuted || '#888', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
                            {editHistoryModal.loading && (
                                <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
                            )}
                            {!editHistoryModal.loading && editHistoryModal.edits.length === 0 && (
                                <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>Düzenleme geçmişi bulunamadı.<br /><span style={{ fontSize: '11px', opacity: 0.6 }}>(Eski düzenlemeler geçmişe kaydedilmemiş olabilir)</span></div>
                            )}
                            {editHistoryModal.edits.map((edit, idx) => (
                                <div key={idx} style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.05)'}`, position: 'relative' }}>
                                    <div style={{ fontSize: '10px', color: colors?.textMuted || '#666', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ background: idx === 0 ? '#5865F2' : 'rgba(255,255,255,0.08)', color: idx === 0 ? '#fff' : (colors?.textMuted || '#aaa'), padding: '1px 7px', borderRadius: '10px', fontWeight: 600, fontSize: '10px' }}>
                                            {idx === 0 ? 'Orijinal' : `Düzenleme ${idx}`}
                                        </span>
                                        <span>{new Date(edit.edited_at).toLocaleString('tr-TR')}</span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: colors?.text || '#ddd', lineHeight: 1.5, wordBreak: 'break-word' }}>{edit.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Profile Card */}
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
