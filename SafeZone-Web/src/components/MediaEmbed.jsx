import React, { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';

const MediaEmbed = ({ url }) => {
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mediaType, setMediaType] = useState('link'); // 'image', 'video', 'youtube', 'link'

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        // 1. YouTube Detection
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

    if (loading) return null; // Or a subtle skeleton
    if (!previewData && mediaType === 'link') return null;

    const embedStyle = {
        marginTop: '6px',
        maxWidth: '400px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)'
    };

    if (mediaType === 'youtube') {
        return (
            <div style={{ ...embedStyle, width: '400px', height: '225px' }}>
                <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${previewData.videoId}?autoplay=0`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
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
                        onError={(e) => e.target.style.display = 'none'} // Hide on error
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
