import React, { useState, useRef, useEffect } from 'react';

const StreamOverlay = ({ stream, label, onStop }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 240 });
    const [size, setSize] = useState({ width: 320, height: 180 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging.current) {
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;
                setPosition({
                    x: startPos.current.x + dx,
                    y: startPos.current.y + dy
                });
            }
        };
        const handleMouseUp = () => {
            isDragging.current = false;
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = (e) => {
        if (e.target.closest('button')) return;
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        startPos.current = { ...position };
    };

    if (!stream) return null;

    return (
        <div
            onMouseDown={handleMouseDown}
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                backgroundColor: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                border: '2px solid #ED4245', // Red border to indicate recording/sharing
                zIndex: 9999,
                cursor: 'move',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                padding: '8px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 2
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ED4245', display: 'inline-block' }}></span>
                    {label}
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onStop(); }}
                    title="Yayını Durdur"
                    style={{
                        background: '#ED4245',
                        border: 'none',
                        color: 'white',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    }}
                >
                    DURDUR
                </button>
            </div>

            <video
                ref={el => { if (el) el.srcObject = stream; }}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', pointerEvents: 'none' }}
            />
        </div>
    );
};

export default StreamOverlay;
