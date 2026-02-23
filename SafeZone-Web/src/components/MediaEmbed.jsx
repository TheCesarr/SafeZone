import React, { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';

const MediaEmbed = ({ url }) => {
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mediaType, setMediaType] = useState('link');
    const [ytHovered, setYtHovered] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        // 1. YouTube Detection → thumbnail mode (no iframe = no Error 153)
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const ytMatch = url.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            setMediaType('youtube');
            setPreviewData({ videoId: ytMatch[1] });
            setLoading(false);
            return;
        }

        // 2. Direct Image Detection
        if (url.match(/\.(jpeg|jpg|gif|png|webp|svg)(?:\?.*)?$/i)) {
            setMediaType('image');
            setPreviewData({ src: url });
            setLoading(false);
            return;
        }

        // 3. Direct Video Detection
        if (url.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i)) {
            setMediaType('video');
            setPreviewData({ src: url });
            setLoading(false);
            return;
        }

        // 4. Fallback to OpenGraph Link Preview
        setMediaType('link');
        const fetchPreview = async () => {
            try {
                const targetUrl = getUrl('/utils/link-preview');
                const token = localStorage.getItem('safezone_token');
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, token })
                });
                const data = await res.json();
                if (isMounted && data.status === 'success') {
                    setPreviewData(data);
                }
            } catch (e) {
                console.error("Link preview error:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchPreview();
        return () => { isMounted = false; };
    }, [url]);

    if (loading) return null;
    if (!previewData && mediaType === 'link') return null;

    const embedStyle = {
        marginTop: '6px',
        maxWidth: '400px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)'
    };

    // YouTube: thumbnail + overlay play button → opens YouTube on click
    if (mediaType === 'youtube') {
        const { videoId } = previewData;
        const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        return (
            <div style={{ ...embedStyle, width: '400px', position: 'relative', cursor: 'pointer' }}
                onMouseEnter={() => setYtHovered(true)}
                onMouseLeave={() => setYtHovered(false)}
                onClick={() => window.open(ytUrl, '_blank')}
            >
                {/* Thumbnail */}
                <img
                    src={thumb}
                    alt="YouTube video"
                    style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; }}
                />
                {/* Dark overlay on hover */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: ytHovered ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)',
                    transition: 'background 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: '8px'
                }}>
                    {/* Play button */}
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: ytHovered ? '#FF0000' : 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                    }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                            <polygon points="5,3 19,12 5,21" />
                        </svg>
                    </div>
                    {/* "YouTube'da izle" label */}
                    <div style={{
                        fontSize: '12px', color: 'rgba(255,255,255,0.85)',
                        background: 'rgba(0,0,0,0.5)', padding: '3px 8px',
                        borderRadius: '4px', backdropFilter: 'blur(4px)'
                    }}>
                        ▶ YouTube'da izle
                    </div>
                </div>
            </div>
        );
    }

    if (mediaType === 'image') {
        return (
            <div style={embedStyle}>
                <a href={previewData.src} target="_blank" rel="noreferrer">
                    <img
                        src={previewData.src}
                        alt="embed"
                        style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', display: 'block' }}
                        onError={(e) => e.target.style.display = 'none'}
                    />
                </a>
            </div>
        );
    }

    if (mediaType === 'video') {
        return (
            <div style={embedStyle}>
                <video
                    src={previewData.src}
                    controls
                    style={{ width: '100%', maxHeight: '350px', display: 'block' }}
                />
            </div>
        );
    }

    // Default Link Preview (OpenGraph)
    if (mediaType === 'link' && previewData) {
        return (
            <a href={previewData.url} target="_blank" rel="noreferrer" style={{ display: 'flex', textDecoration: 'none', color: 'inherit', background: '#2f3136', borderRadius: '5px', marginTop: '6px', maxWidth: '400px', overflow: 'hidden', borderLeft: '4px solid #00b0f4' }}>
                <div style={{ padding: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', color: '#00b0f4', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{previewData.title || url}</div>
                    <div style={{ fontSize: '12px', color: '#b9bbbe', marginTop: '5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{previewData.description || 'Linke gitmek için tıklayın.'}</div>
                </div>
                {previewData.image && <div style={{ width: '100px', background: `url(${previewData.image}) center/cover` }}></div>}
            </a>
        );
    }

    return null;
};

export default MediaEmbed;
