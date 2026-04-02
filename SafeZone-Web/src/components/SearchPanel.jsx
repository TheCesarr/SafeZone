import React from 'react';

/**
 * SearchPanel — Right sidebar for searching messages in a channel.
 * State is controlled by the parent (ChatArea).
 */
const SearchPanel = ({
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    handleSearch,
    colors = {},
}) => {
    return (
        <div style={{
            width: '320px', flexShrink: 0,
            background: colors?.card || '#1e1f22',
            borderLeft: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`,
            display: 'flex', flexDirection: 'column', overflowY: 'auto'
        }}>
            <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${colors?.border || 'rgba(255,255,255,0.07)'}`,
                display: 'flex', gap: '8px', alignItems: 'center'
            }}>
                <input
                    autoFocus
                    placeholder="Mesajlarda ara..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
                    style={{
                        flex: 1, background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px', padding: '8px 12px',
                        color: colors?.text || '#fff', fontSize: '14px', outline: 'none'
                    }}
                />
                <button
                    onClick={() => handleSearch(searchQuery)}
                    disabled={searchLoading}
                    style={{
                        background: colors?.accent || '#5865F2', border: 'none', color: '#fff',
                        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                        fontWeight: 600, fontSize: '13px'
                    }}
                >
                    {searchLoading ? '...' : 'Ara'}
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {searchResults.length === 0 && !searchLoading && searchQuery.length > 1 && (
                    <div style={{ color: colors?.textMuted || '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
                        Sonuç bulunamadı
                    </div>
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
    );
};

export default React.memo(SearchPanel);
