import React, { useEffect } from 'react';

const Modal = ({ title, onClose, children, width = '400px', colors }) => {

    // Handle Escape Key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Theme Styles
    const modalBg = colors?.card ? colors.card + 'D9' : 'rgba(30, 31, 34, 0.85)'; // Add opacity to hex if possible, or fallback
    // Note: Hex + D9 is approx 85% opacity. If colors.card is rgb/name, this fails. 
    // Safer: Use colors.card directly and rely on CSS backdrop-filter, or assume hex.
    const safeBg = colors?.card || 'rgba(30, 31, 34, 0.85)';
    const textColor = colors?.text || 'white';
    
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
                className="glass-modal animate-scale-in"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: width,
                    padding: '24px',
                    color: textColor,
                    backgroundColor: safeBg,
                    border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}
            >
                {title && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{title}</h2>
                        <button
                            onClick={onClose}
                            className="interactive-button"
                            style={{ background: 'transparent', border: 'none', color: colors?.textMuted || '#aaa', fontSize: '20px', padding: '4px' }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {children}
            </div>
        </div>
    );
};

export default Modal;
