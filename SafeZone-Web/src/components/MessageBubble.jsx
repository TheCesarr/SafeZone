import React from 'react';
import { getUrl } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MediaEmbed from './MediaEmbed';

/**
 * MessageBubble — Renders a single chat message with avatar, content,
 * reply context, attachments, reactions, and edit state.
 *
 * Props are passed from ChatArea; this component is purely presentational.
 */
const MessageBubble = ({
    msg,
    index,
    prevMsg,
    currentUser,
    isMe,
    isGrouped,
    isMentioned,
    editingMessageId,
    editText,
    setEditText,
    setEditingMessageId,
    submitEdit,
    handleMessageContextMenu,
    serverMembers,
    getRoleColor,
    colors,
    authToken,
    setMessages,
    setSelectedUserForProfile,
    setEditHistoryModal,
}) => {
    const sender = typeof msg === 'string' ? msg.split(': ')[0] : msg.sender;
    const text = (typeof msg === 'string' ? msg.split(': ').slice(1).join(': ') : (msg.content || msg.text)) || "";

    const openProfileCard = (e, username) => {
        e.stopPropagation();
        const member = serverMembers.find(m => m.username === username) || { username };
        setSelectedUserForProfile({
            user: {
                username,
                display_name: member.display_name,
                avatar_url: member.avatar_url,
                avatar_color: member.avatar_color || (username === currentUser.username ? '#3ba55c' : '#5865F2'),
                status: member.status || 'offline',
                role_color: member.role_color,
                highest_role: member.highest_role,
                custom_status: member.custom_status,
                is_sysadmin: member.is_sysadmin
            },
            rect: e.currentTarget.getBoundingClientRect()
        });
    };

    return (
        <div
            className="message-row"
            style={{
                display: 'flex',
                flexDirection: 'column',
                paddingTop: isGrouped ? '2px' : '10px',
                marginTop: isGrouped ? 0 : '4px',
                ...(isMentioned ? {
                    background: 'rgba(250, 166, 26, 0.08)',
                    borderLeft: '3px solid #FAA61A',
                    paddingLeft: '8px',
                    marginLeft: '-11px',
                    borderRadius: '0 4px 4px 0',
                } : {})
            }}
        >
            {/* Reply Context Banner */}
            {msg.reply_to && msg.reply_to.sender && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
                    color: colors?.textMuted || '#b5bac1', fontSize: '13px', position: 'relative',
                    paddingLeft: '50px', marginTop: '-4px'
                }}>
                    <div style={{
                        position: 'absolute', left: '18px', top: '50%', width: '24px', height: '14px',
                        borderLeft: `2px solid ${colors?.border || '#4f545c'}`,
                        borderTop: `2px solid ${colors?.border || '#4f545c'}`,
                        borderTopLeftRadius: '6px', transform: 'translateY(-6px)'
                    }} />
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                        {(() => {
                            const rm = serverMembers.find(m => m.username === msg.reply_to.sender);
                            if (rm && rm.avatar_url) return <img src={getUrl(rm.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                            return <div style={{ width: '100%', height: '100%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff' }}>{msg.reply_to.sender.slice(0, 2).toUpperCase()}</div>;
                        })()}
                    </div>
                    <span style={{ fontWeight: 600, color: getRoleColor(msg.reply_to.sender) || (colors?.text || '#f2f3f5'), cursor: 'pointer' }}>@{msg.reply_to.sender}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px', cursor: 'pointer', opacity: 0.8 }} title="Mesaja git">{msg.reply_to.text}</span>
                </div>
            )}

            {/* Main message row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{ width: '38px', flexShrink: 0 }}>
                    {!isGrouped && (
                        <div
                            onClick={(e) => openProfileCard(e, sender)}
                            style={{
                                width: '38px', height: '38px', borderRadius: '50%',
                                background: `linear-gradient(135deg, ${isMe ? '#3ba55c' : '#5865F2'}, ${isMe ? '#2d8049' : '#4752c4'})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '14px', fontWeight: '600', color: '#fff',
                                letterSpacing: '0.5px', cursor: 'pointer', overflow: 'hidden'
                            }}
                        >
                            {(() => {
                                const member = serverMembers.find(m => m.username === sender);
                                if (member && member.avatar_url) return <img src={getUrl(member.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                return sender.slice(0, 2).toUpperCase();
                            })()}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                    {/* Sender name + timestamp */}
                    {!isGrouped && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span onClick={(e) => openProfileCard(e, sender)} style={{ fontWeight: '600', fontSize: '15px', color: getRoleColor(sender) || (isMe ? '#3ba55c' : (colors?.text || '#fff')), cursor: 'pointer' }}>{sender}</span>
                            <span style={{ fontSize: '11px', color: colors?.textMuted || '#72767d', fontWeight: '400' }}>
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </div>
                    )}

                    {/* Edit mode or message content */}
                    {editingMessageId === msg.id ? (
                        <div style={{ marginTop: '4px' }}>
                            <input
                                value={editText || ""}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditingMessageId(null); }}
                                autoFocus
                                style={{ width: '100%', background: colors?.card || '#40444b', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', padding: '8px 12px', color: colors?.text || '#dcddde', outline: 'none', fontSize: '14px' }}
                            />
                            <div style={{ fontSize: '11px', marginTop: '4px', color: colors?.textMuted || '#b9bbbe' }}>
                                Vazgeçmek için <span style={{ color: colors?.accent || '#00b0f4', fontWeight: '500' }}>ESC</span>, kaydetmek için <span style={{ color: colors?.accent || '#00b0f4', fontWeight: '500' }}>Enter</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div
                                style={{ color: colors?.text || '#dcddde', marginTop: isGrouped ? 0 : '2px', cursor: 'context-menu', fontSize: '14px', lineHeight: '1.45' }}
                                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                            >
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: colors?.accent || '#00b0f4', textDecoration: 'none' }}>{children}</a>,
                                        code: ({ inline, children }) => (
                                            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '3px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.88em' }}>{children}</code>
                                        ),
                                        pre: ({ children }) => (
                                            <pre style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '6px', overflowX: 'auto', margin: '6px 0', border: '1px solid rgba(255,255,255,0.06)' }}>{children}</pre>
                                        ),
                                        text: ({ node, children }) => {
                                            if (typeof children !== 'string') return children;
                                            const mentionRegex = /@([a-zA-Z0-9_ğüşöçİĞÜŞÖÇ]+)/g;
                                            const parts = children.split(mentionRegex);
                                            if (parts.length === 1) return children;
                                            return (
                                                <>
                                                    {parts.map((part, i) => {
                                                        if (i % 2 === 1) {
                                                            const isMeMention = part === currentUser.username;
                                                            return (
                                                                <span key={i} style={{ background: isMeMention ? 'rgba(250, 166, 26, 0.2)' : 'rgba(88, 101, 242, 0.3)', color: isMeMention ? '#FAA61A' : '#c9cdfb', padding: '0 4px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer' }}>@{part}</span>
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
                                {msg.edited_at && (
                                    <span
                                        style={{ fontSize: '10px', color: '#72767d', marginLeft: '5px', cursor: 'pointer', borderBottom: '1px dotted #555', transition: 'color 0.1s' }}
                                        onMouseEnter={e => e.target.style.color = '#aaa'}
                                        onMouseLeave={e => e.target.style.color = '#72767d'}
                                        title="Düzenleme geçmişini göster"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!msg.id || !authToken) return;
                                            setEditHistoryModal({ msgId: msg.id, edits: [], loading: true });
                                            try {
                                                const res = await fetch(getUrl(`/message/${msg.id}/edits?token=${authToken}`));
                                                const data = await res.json();
                                                setEditHistoryModal({ msgId: msg.id, edits: data.edits || [], loading: false });
                                            } catch { setEditHistoryModal({ msgId: msg.id, edits: [], loading: false }); }
                                        }}
                                    >(düzenlendi)</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attachment */}
                    {msg.attachment_url && (
                        <div style={{ marginTop: '6px' }}>
                            {msg.attachment_type === 'image' ? (
                                <img src={getUrl(msg.attachment_url)} alt="attachment" style={{ maxWidth: '350px', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', transition: 'transform 0.2s' }}
                                    onClick={() => window.open(getUrl(msg.attachment_url), '_blank')}
                                    onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
                                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                />
                            ) : msg.attachment_type === 'video' ? (
                                <video src={getUrl(msg.attachment_url)} controls style={{ maxWidth: '350px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }} />
                            ) : (
                                <a href={getUrl(msg.attachment_url)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: colors?.card || '#2f3136', padding: '10px 14px', borderRadius: '6px', maxWidth: '300px', textDecoration: 'none', color: '#00b0f4', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.06)'}`, transition: 'background 0.15s' }}>
                                    📁 {msg.attachment_name || 'Dosya'}
                                </a>
                            )}
                        </div>
                    )}

                    {/* Media Embed */}
                    {(() => {
                        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
                        if (urlMatch && !msg.attachment_url) return <MediaEmbed url={urlMatch[0]} />;
                        return null;
                    })()}

                    {/* Reactions */}
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
                                                        setMessages && setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: data.reactions } : m));
                                                    }
                                                }
                                            } catch (err) { console.error(err); }
                                        }}
                                        style={{ background: hasReacted ? 'rgba(88, 101, 242, 0.15)' : (colors?.card || '#2b2d31'), border: `1px solid ${hasReacted ? '#5865F2' : 'transparent'}`, borderRadius: '8px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '1rem', userSelect: 'none', transition: 'transform 0.1s, background 0.1s' }}
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
};

export default React.memo(MessageBubble);
