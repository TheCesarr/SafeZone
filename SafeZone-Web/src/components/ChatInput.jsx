import React, { useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

/**
 * ChatInput — Message input area with file upload, emoji picker,
 * @mention autocomplete, typing indicator, attachment preview,
 * and reply-to banner.
 *
 * All state is managed by the parent (ChatArea) and passed as props.
 */
const ChatInput = ({
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
    selectedChannel,
    selectedDM,
    currentUser,
    onlineMembers = [],
    colors = {},
    replyingTo = null,
    setReplyingTo,
    canSendMessages,
    canAttachFiles,
}) => {
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [mentionQuery, setMentionQuery] = React.useState(null);
    const [mentionSuggestions, setMentionSuggestions] = React.useState([]);

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
        ":|'": '😐', ':|': '😐', ':-|': '😐',
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
        let result = text;
        const sorted = Object.keys(EMOJI_SHORTCUTS).sort((a, b) => b.length - a.length);
        for (const shortcut of sorted) {
            const escaped = shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<=[^\\S]|^)(${escaped})(?=\\s|$)`, 'g');
            result = result.replace(regex, EMOJI_SHORTCUTS[shortcut]);
        }
        return result;
    };

    return (
        <>
            {/* Attachment Preview */}
            {attachment && (
                <div style={{
                    background: colors?.card || 'rgba(255,255,255,0.04)',
                    padding: '8px 14px', margin: '0 20px 6px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center',
                    border: `1px solid ${colors?.border || 'rgba(255,255,255,0.08)'}`,
                    backdropFilter: 'blur(8px)',
                }}>
                    <span style={{ fontSize: '18px', marginRight: '8px' }}>📎</span>
                    <span style={{ flexGrow: 1, color: colors?.text || '#fff', fontSize: '13px' }}>
                        {attachment.name} <span style={{ color: colors?.textMuted || '#72767d' }}>({attachment.type})</span>
                    </span>
                    <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: '#ed4245', cursor: 'pointer', fontSize: '16px', padding: '4px', borderRadius: '4px', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.target.style.background = 'rgba(237,66,69,0.1)'}
                        onMouseLeave={e => e.target.style.background = 'none'}
                    >✕</button>
                </div>
            )}

            {/* Replying To Banner */}
            {replyingTo && (
                <div style={{
                    background: '#2b2d31', padding: '8px 12px 8px 16px', margin: '0 20px',
                    borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center',
                    borderTop: `1px solid ${colors?.border || 'transparent'}`,
                    borderLeft: `1px solid ${colors?.border || 'transparent'}`,
                    borderRight: `1px solid ${colors?.border || 'transparent'}`,
                    position: 'relative', top: '12px', zIndex: 1
                }}>
                    <span style={{ color: '#b5bac1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                        <strong style={{ color: '#f2f3f5', fontWeight: 600 }}>{replyingTo.sender}</strong> kişisine yanıt veriliyor
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: '#00a8fc', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '14px' }}>@</span> AÇIK
                        </span>
                        <button onClick={() => setReplyingTo(null)} style={{ background: '#232428', border: 'none', color: '#b5bac1', cursor: 'pointer', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'color 0.15s' }}
                            onMouseEnter={e => e.target.style.color = '#fff'}
                            onMouseLeave={e => e.target.style.color = '#b5bac1'}
                        >×</button>
                    </div>
                </div>
            )}

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
                <div style={{ padding: '0 20px 4px 74px', color: colors?.textMuted || '#b9bbbe', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <div style={{ padding: '12px 20px 16px', background: 'transparent', position: 'relative' }}>
                {/* @Mention Autocomplete Popup */}
                {mentionSuggestions.length > 0 && (
                    <div style={{
                        position: 'absolute', bottom: '70px', left: '20px', right: '20px',
                        background: colors?.card || '#2f3136',
                        border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '8px', overflow: 'hidden', zIndex: 100,
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
                            style={{ cursor: 'pointer', marginRight: '10px', fontSize: '20px', color: isUploading ? '#faa61a' : (colors?.textMuted || 'rgba(255,255,255,0.3)'), transition: 'color 0.15s, transform 0.15s', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '4px' }}
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
                            if (val.endsWith(' ')) val = replaceEmojiShortcuts(val);
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
                                    setMentionSuggestions(onlineMembers.filter(m => m.username !== currentUser.username && m.username.toLowerCase().startsWith(query.toLowerCase())));
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
                            style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '8px', color: showEmojiPicker ? (colors?.accent || '#5865F2') : (colors?.textMuted || 'rgba(255,255,255,0.3)'), transition: 'color 0.15s, transform 0.15s', userSelect: 'none', lineHeight: 1 }}
                            onMouseEnter={e => { e.target.style.color = colors?.accent || '#5865F2'; e.target.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.target.style.color = showEmojiPicker ? (colors?.accent || '#5865F2') : (colors?.textMuted || 'rgba(255,255,255,0.3)'); e.target.style.transform = 'scale(1)'; }}
                        >😊</span>

                        {showEmojiPicker && (
                            <div style={{ position: 'absolute', bottom: '44px', right: '0', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', borderRadius: '12px', overflow: 'hidden' }}>
                                <EmojiPicker
                                    onEmojiClick={(emojiData) => {
                                        const emoji = emojiData.emoji;
                                        const el = inputRef.current;
                                        if (el) {
                                            const start = el.selectionStart ?? inputText.length;
                                            const end = el.selectionEnd ?? inputText.length;
                                            const newText = inputText.slice(0, start) + emoji + inputText.slice(end);
                                            setInputText(newText);
                                            setTimeout(() => { el.focus(); const pos = start + emoji.length; el.setSelectionRange(pos, pos); }, 0);
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
        </>
    );
};

export default React.memo(ChatInput);
