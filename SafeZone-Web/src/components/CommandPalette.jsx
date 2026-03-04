import React from 'react';

/**
 * CommandPalette — açmak için Ctrl+K / Cmd+K
 * Props:
 *   open: bool
 *   onClose: () => void
 *   servers: [{id, name, channels: [{id, name, type}]}]
 *   friends: [{username, display_name, status}]
 *   onSelectChannel: (server, channel) => void
 *   onSelectFriend: (friend) => void
 *   colors: theme object
 */
const CommandPalette = ({ open, onClose, servers = [], friends = [], onSelectChannel, onSelectFriend, colors }) => {
    const [query, setQuery] = React.useState('');
    const [cursor, setCursor] = React.useState(0);
    const inputRef = React.useRef(null);

    // Build flat list of all items
    const allItems = React.useMemo(() => {
        const items = [];
        servers.forEach(server => {
            (server.channels || []).forEach(ch => {
                items.push({
                    type: 'channel',
                    id: `${server.id}-${ch.id}`,
                    label: ch.name,
                    sublabel: server.name,
                    icon: ch.type === 'voice' ? '🔊' : '#',
                    server,
                    channel: ch,
                });
            });
        });
        friends.forEach(f => {
            items.push({
                type: 'dm',
                id: `dm-${f.username}`,
                label: f.display_name || f.username,
                sublabel: `@${f.username}`,
                icon: '👤',
                friend: f,
            });
        });
        return items;
    }, [servers, friends]);

    const filtered = React.useMemo(() => {
        if (!query.trim()) return allItems.slice(0, 12);
        const q = query.toLowerCase();
        return allItems.filter(item =>
            item.label.toLowerCase().includes(q) || item.sublabel?.toLowerCase().includes(q)
        ).slice(0, 15);
    }, [query, allItems]);

    React.useEffect(() => {
        setCursor(0);
    }, [query, filtered.length]);

    React.useEffect(() => {
        if (open) {
            setQuery('');
            setCursor(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const handleSelect = (item) => {
        if (item.type === 'channel') onSelectChannel?.(item.server, item.channel);
        else if (item.type === 'dm') onSelectFriend?.(item.friend);
        onClose?.();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') { if (filtered[cursor]) handleSelect(filtered[cursor]); }
        else if (e.key === 'Escape') { onClose?.(); }
    };

    if (!open) return null;

    const bg = colors?.card || '#1e1f22';
    const text = colors?.text || '#fff';
    const muted = colors?.textMuted || '#888';
    const accent = colors?.accent || '#5865F2';
    const border = colors?.border || 'rgba(255,255,255,0.08)';

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 99990, backdropFilter: 'blur(4px)' }}
            />
            {/* Palette */}
            <div
                style={{
                    position: 'fixed',
                    top: '18vh',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 99991,
                    width: '560px',
                    maxWidth: '94vw',
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: '14px',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
                    overflow: 'hidden',
                    animation: 'szCpIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onKeyDown={handleKeyDown}
                tabIndex={-1}
            >
                <style>{`
                    @keyframes szCpIn {
                        from { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.96); }
                        to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                    }
                    .sz-cp-item:hover { background: rgba(255,255,255,0.06) !important; }
                `}</style>

                {/* Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${border}`, gap: '12px' }}>
                    <span style={{ fontSize: '18px', opacity: 0.6 }}>🔍</span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Kanal, sunucu veya kullanıcı ara..."
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            color: text,
                            fontSize: '16px',
                            fontFamily: 'inherit',
                        }}
                    />
                    <kbd style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${border}`, borderRadius: '5px', padding: '2px 7px', fontSize: '11px', color: muted }}>ESC</kbd>
                </div>

                {/* Results */}
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: muted, fontSize: '14px' }}>
                            Sonuç bulunamadı
                        </div>
                    ) : (
                        filtered.map((item, idx) => (
                            <div
                                key={item.id}
                                className="sz-cp-item"
                                onClick={() => handleSelect(item)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 18px',
                                    cursor: 'pointer',
                                    background: idx === cursor ? (accent + '22') : 'transparent',
                                    borderLeft: idx === cursor ? `3px solid ${accent}` : '3px solid transparent',
                                    transition: 'background 0.1s, border-color 0.1s',
                                }}
                                onMouseEnter={() => setCursor(idx)}
                            >
                                <span style={{ fontSize: '16px', opacity: 0.75, flexShrink: 0, width: '20px', textAlign: 'center' }}>{item.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: text, fontSize: '14px', fontWeight: idx === cursor ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                                    {item.sublabel && <div style={{ color: muted, fontSize: '12px', marginTop: '1px' }}>{item.sublabel}</div>}
                                </div>
                                <span style={{ fontSize: '11px', color: muted, flexShrink: 0, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                                    {item.type === 'channel' ? 'Kanal' : 'Mesaj'}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '8px 18px', borderTop: `1px solid ${border}`, display: 'flex', gap: '16px', color: muted, fontSize: '11px' }}>
                    <span><kbd style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${border}`, borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>↑↓</kbd> Gezin</span>
                    <span><kbd style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${border}`, borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>↵</kbd> Aç</span>
                    <span><kbd style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${border}`, borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>ESC</kbd> Kapat</span>
                </div>
            </div>
        </>
    );
};

export default CommandPalette;
