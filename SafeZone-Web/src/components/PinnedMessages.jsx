import React from 'react';

/**
 * PinnedMessages — Right sidebar for displaying pinned messages.
 * State is controlled by the parent (ChatArea).
 */
const PinnedMessages = ({
    pinnedMessages,
    pinsLoading,
    onClose,
    colors = {},
}) => {
    return (
        <div style={{
            width: '320px', flexShrink: 0,
            background: colors?.card || '#1e1f22',
            borderLeft: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`,
            display: 'flex', flexDirection: 'column'
        }}>
            <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`,
                fontWeight: 700, color: colors?.text || '#fff', fontSize: '14px',
                display: 'flex', alignItems: 'center', gap: '8px'
            }}>
                📌 Sabitlenmiş Mesajlar
                <button
                    onClick={onClose}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: colors?.textMuted || '#888', cursor: 'pointer', fontSize: '16px' }}
                >×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {pinsLoading && (
                    <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
                        Yükleniyor...
                    </div>
                )}
                {!pinsLoading && pinnedMessages.length === 0 && (
                    <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
                        📌 Sabitlenmiş mesaj yok
                    </div>
                )}
                {pinnedMessages.map(pin => (
                    <div key={pin.id} style={{ padding: '10px', borderRadius: '6px', marginBottom: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(250,166,26,0.2)' }}>
                        <div style={{ fontSize: '12px', color: '#FAA61A', fontWeight: 600, marginBottom: '4px' }}>📌 {pin.sender}</div>
                        <div style={{ fontSize: '13px', color: colors?.text || '#ddd', lineHeight: 1.4 }}>{pin.content || pin.text}</div>
                        <div style={{ fontSize: '10px', color: colors?.textMuted || '#666', marginTop: '4px' }}>{new Date(pin.timestamp).toLocaleString('tr-TR')}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default React.memo(PinnedMessages);
