import React, { useRef } from 'react';
import { getUrl } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LinkPreview from './LinkPreview';

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
    colors = {}
}) => {
    const currentMessages = (selectedDM ? dmHistory : messages) || [];
    const fileInputRef = useRef(null);

    return (
        <>
            <div style={{ flexGrow: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {currentMessages.map((msg, i) => {
                    const sender = typeof msg === 'string' ? msg.split(': ')[0] : (selectedDM ? msg.sender : msg.sender);
                    const text = (typeof msg === 'string' ? msg.split(': ').slice(1).join(': ') : (selectedDM ? msg.content : (msg.content || msg.text))) || "";
                    const isMe = sender === currentUser.username;

                    // Group consecutive messages from the same sender
                    const prevMsg = currentMessages[i - 1];
                    const prevSender = prevMsg ? (typeof prevMsg === 'string' ? prevMsg.split(': ')[0] : prevMsg.sender) : null;
                    const isGrouped = prevSender === sender;

                    return (
                        <div
                            key={i}
                            className="message-row"
                            style={{
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start',
                                paddingTop: isGrouped ? '2px' : '10px',
                                marginTop: isGrouped ? 0 : '4px',
                            }}
                        >
                            {/* Avatar: show only for first message in group */}
                            <div style={{ width: '38px', flexShrink: 0 }}>
                                {!isGrouped && (
                                    <div style={{
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
                                    }}>
                                        {sender.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                                {!isGrouped && (
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{
                                            fontWeight: '600',
                                            fontSize: '15px',
                                            color: isMe ? '#3ba55c' : (colors?.text || '#fff'),
                                        }}>{sender}</span>
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
                                    <div
                                        style={{
                                            color: colors?.text || '#dcddde',
                                            marginTop: isGrouped ? 0 : '2px',
                                            cursor: isMe ? 'context-menu' : 'text',
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
                                                )
                                            }}
                                        >
                                            {text}
                                        </ReactMarkdown>
                                        {msg.edited_at && <span style={{ fontSize: '10px', color: '#72767d', marginLeft: '5px' }}>(düzenlendi)</span>}
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
                                        return <LinkPreview url={urlMatch[0]} />;
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    )
                })}
            </div>

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
            }}>
                <div className="chat-input-wrapper">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                    <span
                        onClick={() => { if (!isUploading) fileInputRef.current?.click() }}
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
                    <input
                        className="chat-input"
                        type="text"
                        placeholder={`Mesaj gönder: ${selectedDM ? '@' + selectedDM.username : (selectedChannel ? '#' + selectedChannel.name : '')}`}
                        value={inputText}
                        onChange={handleTyping}
                        onKeyDown={e => e.key === 'Enter' && (selectedDM ? onSendDM() : onSendMessage())}
                        style={{ color: colors?.text || '#fff' }}
                    />
                </div>
            </div>
        </>
    );
};

export default ChatArea;
