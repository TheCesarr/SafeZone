import React from 'react';

const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

const COLORS = {
    success: '#3ba55c',
    error: '#ed4245',
    warning: '#faa61a',
    info: '#5865F2',
};

const ToastContainer = ({ toasts, onRemove }) => {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none',
        }}>
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    style={{
                        pointerEvents: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        minWidth: '280px',
                        maxWidth: '420px',
                        background: 'rgba(30, 31, 34, 0.92)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: `1px solid rgba(255,255,255,0.08)`,
                        borderLeft: `4px solid ${COLORS[toast.type] || COLORS.info}`,
                        borderRadius: '8px',
                        boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 12px ${COLORS[toast.type] || COLORS.info}22`,
                        color: '#fff',
                        fontSize: '14px',
                        animation: toast.exiting ? 'toastOut 0.3s ease-in forwards' : 'toastIn 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards',
                    }}
                >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>
                        {ICONS[toast.type] || ICONS.info}
                    </span>
                    <span style={{ flex: 1, lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {toast.message}
                    </span>
                    <span
                        onClick={() => onRemove(toast.id)}
                        style={{
                            cursor: 'pointer',
                            opacity: 0.5,
                            fontSize: '16px',
                            flexShrink: 0,
                            transition: 'opacity 0.15s',
                            padding: '2px',
                        }}
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.5}
                    >
                        ✕
                    </span>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
