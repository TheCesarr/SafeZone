import React, { useState, useEffect } from 'react';

const UpdateNotifier = ({ colors }) => {
    const [updateStatus, setUpdateStatus] = useState(null); // 'available', 'downloading', 'downloaded'
    const [version, setVersion] = useState('');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!window.SAFEZONE_API) return;

        window.SAFEZONE_API.onUpdateAvailable((info) => {
            setVersion(info?.version || 'Yeni Sürüm');
            setUpdateStatus('available');
        });

        window.SAFEZONE_API.onUpdateProgress((prog) => {
            setUpdateStatus('downloading');
            setProgress(Math.round(prog.percent));
        });

        window.SAFEZONE_API.onUpdateDownloaded((info) => {
            setVersion(info?.version || 'Yeni Sürüm');
            setUpdateStatus('downloaded');
        });
    }, []);

    if (!updateStatus) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: colors.card,
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 9999,
            width: '320px',
            border: `1px solid ${colors.accent}40`,
            fontFamily: 'Inter, sans-serif'
        }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🚀</span>
                {updateStatus === 'available' && 'Güncelleme Bulundu'}
                {updateStatus === 'downloading' && 'Güncelleme İndiriliyor'}
                {updateStatus === 'downloaded' && 'Güncelleme Hazır!'}
            </h3>

            {updateStatus === 'available' && (
                <p style={{ margin: 0, fontSize: '14px', color: '#b9bbbe' }}>
                    v{version} indiriliyor. Arka planda hazırlanıyor, indirme sırasında uygulamayı kullanmaya devam edebilirsiniz.
                </p>
            )}

            {updateStatus === 'downloading' && (
                <div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#b9bbbe' }}>
                        v{version} indiriliyor...
                    </p>
                    <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: colors.accent, transition: 'width 0.2s' }} />
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: colors.accent, textAlign: 'right', fontWeight: 'bold' }}>
                        %{progress}
                    </p>
                </div>
            )}

            {updateStatus === 'downloaded' && (
                <div>
                    <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#b9bbbe' }}>
                        v{version} kuruluma hazır. SafeZone'un güncellenmesi için uygulamayı yeniden başlatın.
                    </p>
                    <button
                        onClick={() => window.SAFEZONE_API.installUpdate()}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: colors.accent,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.opacity = 0.8}
                        onMouseOut={(e) => e.target.style.opacity = 1}
                    >
                        Güncelle ve Yeniden Başlat
                    </button>
                </div>
            )}
        </div>
    );
};

export default UpdateNotifier;
