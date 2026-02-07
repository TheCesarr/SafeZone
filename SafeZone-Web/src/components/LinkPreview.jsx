import React, { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';

const LinkPreview = ({ url }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Correctly get the full API URL for the endpoint
        const targetUrl = getUrl('/utils/link-preview');

        // Check if token exists in localStorage (rudimentary auth check)
        const token = localStorage.getItem('safezone_token');

        let isMounted = true;

        fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, token })
        }).then(res => res.json()).then(d => {
            if (isMounted) {
                if (d.status === 'success') setData(d);
                setLoading(false);
            }
        }).catch(() => {
            if (isMounted) setLoading(false);
        });

        return () => { isMounted = false; };
    }, [url]);

    if (loading || !data) return null;

    return (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', textDecoration: 'none', color: 'inherit', background: '#2f3136', borderRadius: '5px', marginTop: '5px', maxWidth: '400px', overflow: 'hidden', borderLeft: '4px solid #00b0f4' }}>
            <div style={{ padding: '10px', flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', color: '#00b0f4', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.title}</div>
                <div style={{ fontSize: '12px', color: '#b9bbbe', marginTop: '5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.description}</div>
            </div>
            {data.image && <div style={{ width: '100px', background: `url(${data.image}) center/cover` }}></div>}
        </a>
    );
}

export default LinkPreview;
