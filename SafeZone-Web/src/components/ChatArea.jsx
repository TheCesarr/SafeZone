import React from 'react';
import { getUrl } from '../utils/api';
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
    fileInputRef,
    handleFileSelect,
    editingMessageId,
    setEditingMessageId,
    editText,
    setEditText,
    submitEdit,
    handleMessageContextMenu
}) => {
    const currentMessages = selectedDM ? dmHistory : messages;

    return (
        <>
            <div style={{ flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {currentMessages.map((msg, i) => {
                    const sender = typeof msg === 'string' ? msg.split(': ')[0] : (selectedDM ? msg.sender : msg.sender);
                    const text = typeof msg === 'string' ? msg.split(': ').slice(1).join(': ') : (selectedDM ? msg.content : (msg.content || msg.text));
                    const isMe = sender === currentUser.username;

                    return (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', group: 'message-group' }}>
                            <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#5865F2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {sender.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: isMe ? '#34C759' : '#fff' }}>{sender}</span>
                                </div>

                                {editingMessageId === msg.id ? (
                                    <div style={{ marginTop: '5px' }}>
                                        <input
                                            value={editText}
                                            onChange={e => setEditText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') submitEdit();
                                                if (e.key === 'Escape') setEditingMessageId(null);
                                            }}
                                            autoFocus
                                            style={{
                                                width: '100%', background: '#40444b', border: 'none', borderRadius: '5px',
                                                padding: '8px', color: '#dcddde', outline: 'none'
                                            }}
                                        />
                                        <div style={{ fontSize: '10px', marginTop: '3px', color: '#b9bbbe' }}>
                                            Vazgeçmek için <span style={{ color: '#00b0f4' }}>ESC</span>, kaydetmek için <span style={{ color: '#00b0f4' }}>Enter</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        style={{ color: '#dcddde', marginTop: '2px', whiteSpace: 'pre-wrap', cursor: isMe ? 'context-menu' : 'text' }}
                                        onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                                    >
                                        {text}
                                        {msg.edited_at && <span style={{ fontSize: '10px', color: '#72767d', marginLeft: '5px' }}>(düzenlendi)</span>}
                                    </div>
                                )}

                                {msg.attachment_url && (
                                    <div style={{ marginTop: '5px' }}>
                                        {msg.attachment_type === 'image' ? (
                                            <img src={getUrl(msg.attachment_url)} alt="attachment" style={{ maxWidth: '300px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(getUrl(msg.attachment_url), '_blank')} />
                                        ) : msg.attachment_type === 'video' ? (
                                            <video src={getUrl(msg.attachment_url)} controls style={{ maxWidth: '300px', borderRadius: '8px' }} />
                                        ) : (
                                            <a href={getUrl(msg.attachment_url)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', background: '#2f3136', padding: '10px', borderRadius: '4px', maxWidth: '300px', textDecoration: 'none', color: '#00b0f4' }}>
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

            {attachment && (
                <div style={{ background: '#2f3136', padding: '10px', marginBottom: '10px', borderRadius: '5px', display: 'flex', alignItems: 'center', margin: '0 20px' }}>
                    <span style={{ flexGrow: 1, color: '#fff' }}>{attachment.name} ({attachment.type})</span>
                    <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: '#ed4245', cursor: 'pointer' }}>✖</button>
                </div>
            )}

            {typingUsers.size > 0 && (
                <div style={{ padding: '0 20px 5px 20px', color: '#b9bbbe', fontSize: '12px', fontStyle: 'italic', animation: 'pulse 1.5s infinite' }}>
                    {Array.from(typingUsers).join(', ')} yazıyor...
                </div>
            )}

            <div style={{ padding: '20px', background: 'rgba(22, 22, 22, 0.6)', backdropFilter: 'blur(20px)' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.2)' }}>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                    <span
                        onClick={() => { if (!isUploading) fileInputRef.current?.click() }}
                        style={{ cursor: 'pointer', marginRight: '10px', fontSize: '24px', color: isUploading ? '#faa61a' : '#b9bbbe' }}
                        title="Dosya Yükle"
                    >
                        {isUploading ? '⏳' : '+'}
                    </span>
                    <input
                        type="text"
                        placeholder={`Mesaj gönder: ${selectedDM ? '@' + selectedDM.username : (selectedChannel ? '#' + selectedChannel.name : '')}`}
                        value={inputText}
                        onChange={handleTyping}
                        onKeyDown={e => e.key === 'Enter' && (selectedDM ? onSendDM() : onSendMessage())}
                        style={{ background: 'transparent', border: 'none', color: '#fff', flexGrow: 1, outline: 'none', cursor: 'text' }}
                    />
                </div>
            </div>
        </>
    );
};

export default ChatArea;
