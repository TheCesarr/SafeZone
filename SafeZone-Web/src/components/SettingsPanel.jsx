import React, { useState, useRef } from 'react';
import { getTheme, getPalettes, getPaletteName } from '../utils/themes';
import { getUrl } from '../utils/api';

const SettingsPanel = ({
    show,
    onClose,
    authState,
    theme,
    setTheme,
    colors,
    onLogout,
    inputDevices,
    outputDevices,
    selectedInputId,
    setSelectedInputId,
    selectedOutputId,
    setSelectedOutputId,
    audioSettings,
    setAudioSettings
}) => {
    if (!show) return null;

    const [activeTab, setActiveTab] = useState('profile');

    // Profile Edit State
    const [editDisplayName, setEditDisplayName] = useState(authState.user?.display_name || "");
    const [editAvatarColor, setEditAvatarColor] = useState(authState.user?.avatar_color || "#5865F2");
    const fileInputRef = useRef(null);

    // Mic Test State
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const rafRef = useRef(null);
    const testAudioRef = useRef(null); // For loopback playback

    const startMicTest = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputId && selectedInputId !== 'default' ? { exact: selectedInputId } : undefined,
                    echoCancellation: audioSettings?.echoCancellation ?? true,
                    noiseSuppression: audioSettings?.noiseSuppression ?? true,
                    autoGainControl: audioSettings?.autoGainControl ?? true
                },
                video: false
            });

            // 1. Playback Loopback (Hear yourself)
            if (testAudioRef.current) {
                testAudioRef.current.srcObject = stream;
                if (selectedOutputId && selectedOutputId !== 'default' && testAudioRef.current.setSinkId) {
                    await testAudioRef.current.setSinkId(selectedOutputId);
                }
                await testAudioRef.current.play();
            }

            // 2. Visualizer (Volume Meter)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            source.connect(analyser);
            // Don't connect source to destination here to avoid double audio if using <audio> element, 
            // OR connect here and don't use <audio>. 
            // Using <audio> allows setSinkId easily. So we DON'T connect source->destination in AudioContext.

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVolume = () => {
                if (!analyserRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
                // Normalize 0-255 to 0-100 roughly
                setMicVolume(Math.min(100, (avg / 128) * 100));
                rafRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
            setIsTestingMic(true);

        } catch (e) {
            console.error("Mic Test Error:", e);
            alert("Mikrofon testi başlatılamadı: " + e.message);
        }
    };

    const stopMicTest = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        if (testAudioRef.current) {
            testAudioRef.current.pause();
            if (testAudioRef.current.srcObject) {
                testAudioRef.current.srcObject.getTracks().forEach(t => t.stop());
                testAudioRef.current.srcObject = null;
            }
        }

        if (sourceRef.current) sourceRef.current.disconnect();
        if (audioContextRef.current) audioContextRef.current.close();

        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
        setIsTestingMic(false);
        setMicVolume(0);
    };

    // Cleanup on unmount or close
    React.useEffect(() => {
        return () => stopMicTest();
    }, []);

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('token', authState.token);
        formData.append('file', file);

        try {
            const res = await fetch(getUrl('/user/profile/avatar'), {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert("Avatar yüklendi! Lütfen sayfayı yenileyin.");
                // Simply for preview if we had an avatar_url state
            } else {
                alert("Hata: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Yükleme hatası");
        }
    }

    // Theme
    const palettes = getPalettes();

    const handleSaveProfile = async () => {
        try {
            await fetch(getUrl('/user/profile/update'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: authState.token,
                    display_name: editDisplayName,
                    avatar_color: editAvatarColor
                })
            });
            alert("Profil güncellendi! (Yenileme gerekebilir)");
            // In a real app, successful response would update authState context
        } catch (e) { console.error(e); alert("Hata"); }
    }

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: colors.background, zIndex: 20000, display: 'flex' }}>
            {/* SIDEBAR */}
            <div style={{ width: '250px', background: colors.sidebar, padding: '60px 20px 20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors?.textMuted || '#aaa', marginBottom: '10px', paddingLeft: '10px' }}>KULLANICI AYARLARI</div>
                {['profile', 'voice', 'appearance'].map(tab => (
                    <div
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginBottom: '2px',
                            background: activeTab === tab ? (colors?.cardHover || 'rgba(255,255,255,0.06)') : 'transparent',
                            color: activeTab === tab ? (colors?.text || '#fff') : (colors?.textMuted || '#b9bbbe')
                        }}
                    >
                        {tab === 'profile' ? 'Profilim' : tab === 'voice' ? 'Ses ve Görüntü' : 'Görünüm'}
                    </div>
                ))}

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '10px 0' }}></div>

                <div onClick={onLogout} style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', color: '#f04747' }}>
                    Çıkış Yap
                </div>
            </div>

            {/* CONTENT */}
            <div style={{ flex: 1, padding: '60px 40px', overflowY: 'auto' }}>
                <div style={{ maxWidth: '600px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ color: colors?.text || '#fff' }}>{activeTab === 'profile' ? 'Profilim' : activeTab === 'voice' ? 'Ses Ayarları' : 'Görünüm'}</h2>
                        <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${colors?.text || '#fff'}`, color: colors?.text || '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>X</button>
                    </div>

                    {activeTab === 'profile' && (
                        <div>
                            <div style={{ background: colors.card, padding: '20px', borderRadius: '8px', display: 'flex', gap: '20px' }}>
                                <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            width: '100%', height: '100%', borderRadius: '50%',
                                            background: authState.user?.avatar_url ? `url(${getUrl(authState.user.avatar_url)}) center/cover` : editAvatarColor,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '32px', color: '#fff', cursor: 'pointer', overflow: 'hidden',
                                            border: '2px solid rgba(255,255,255,0.2)'
                                        }}
                                    >
                                        {!authState.user?.avatar_url && authState.user?.display_name?.[0]?.toUpperCase()}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', fontSize: '10px', textAlign: 'center', padding: '2px' }}>DEĞİŞTİR</div>
                                    </div>
                                    <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} accept="image/*" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ marginBottom: '5px', color: colors?.text || '#fff' }}>{authState.user?.username}</h3>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', color: colors?.textMuted || '#bbb', marginBottom: '5px' }}>GÖRÜNEN İSİM</label>
                                        <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} style={{ background: colors?.background || 'rgba(0,0,0,0.2)', border: `1px solid ${colors?.border || 'rgba(255,255,255,0.1)'}`, padding: '10px', color: colors?.text || '#fff', width: '100%', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', color: colors?.textMuted || '#bbb', marginBottom: '5px' }}>AVATAR RENGİ</label>
                                        <input type="color" value={editAvatarColor} onChange={e => setEditAvatarColor(e.target.value)} style={{ borderRadius: '4px', height: '40px', width: '60px', border: 'none', cursor: 'pointer' }} />
                                    </div>
                                    <button onClick={handleSaveProfile} style={{ padding: '10px 20px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Değişiklikleri Kaydet</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div>
                            <div style={{ marginBottom: '20px' }}>
                                <h3>Tema Rengi</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' }}>
                                    {palettes.map(p => (
                                        <div
                                            key={p}
                                            onClick={() => setTheme(prev => ({ ...prev, palette: p }))}
                                            style={{
                                                padding: '15px',
                                                background: theme.palette === p ? colors.accent : colors.card,
                                                border: theme.palette === p ? '2px solid #fff' : '2px solid transparent',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {getPaletteName(p)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 style={{ color: colors?.text || '#fff' }}>Tema Modu</h3>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button onClick={() => setTheme(prev => ({ ...prev, mode: 'dark' }))} style={{ flex: 1, padding: '15px', background: theme.mode === 'dark' ? colors.accent : colors.card, border: 'none', borderRadius: '8px', color: theme.mode === 'dark' ? '#fff' : (colors?.text || '#fff'), cursor: 'pointer' }}>Karanlık</button>
                                    <button onClick={() => setTheme(prev => ({ ...prev, mode: 'light' }))} style={{ flex: 1, padding: '15px', background: theme.mode === 'light' ? colors.accent : colors.card, border: 'none', borderRadius: '8px', color: theme.mode === 'light' ? '#fff' : (colors?.text || '#fff'), cursor: 'pointer' }}>Aydınlık</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'voice' && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', marginBottom: 10 }}>Giriş Aygıtı</label>
                                <select value={selectedInputId} onChange={e => setSelectedInputId(e.target.value)} style={{ width: '100%', padding: 10, background: colors.card, color: colors.text, border: 'none', borderRadius: 4 }}>
                                    {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId}`}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 10 }}>Çıkış Aygıtı</label>
                                <select value={selectedOutputId} onChange={e => setSelectedOutputId(e.target.value)} style={{ width: '100%', padding: 10, background: colors.card, color: colors.text, border: 'none', borderRadius: 4 }}>
                                    {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId}`}</option>)}
                                </select>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <h4 style={{ marginBottom: 10, color: colors.text }}>Ses İşleme</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 10, color: colors.text }}>
                                        <input
                                            type="checkbox"
                                            checked={audioSettings?.noiseSuppression}
                                            onChange={e => setAudioSettings(p => ({ ...p, noiseSuppression: e.target.checked }))}
                                            style={{ width: 16, height: 16 }}
                                        />
                                        Gürültü Engelleme (Noise Suppression)
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 10, color: colors.text }}>
                                        <input
                                            type="checkbox"
                                            checked={audioSettings?.echoCancellation}
                                            onChange={e => setAudioSettings(p => ({ ...p, echoCancellation: e.target.checked }))}
                                            style={{ width: 16, height: 16 }}
                                        />
                                        Eko İptali (Echo Cancellation)
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 10, color: colors.text }}>
                                        <input
                                            type="checkbox"
                                            checked={audioSettings?.autoGainControl}
                                            onChange={e => setAudioSettings(p => ({ ...p, autoGainControl: e.target.checked }))}
                                            style={{ width: 16, height: 16 }}
                                        />
                                        Otomatik Ses Dengeleme (AGC)
                                    </label>
                                </div>
                            </div>

                            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <h4 style={{ marginBottom: 10, color: colors.text }}>Mikrofon Testi</h4>
                                <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
                                    Sesinizi duymak için testi başlatın. (Yankı yapabilir, kulaklık önerilir)
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <button
                                        onClick={isTestingMic ? stopMicTest : startMicTest}
                                        style={{
                                            padding: '8px 16px',
                                            background: isTestingMic ? '#f04747' : colors.accent,
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            minWidth: '100px'
                                        }}
                                    >
                                        {isTestingMic ? "Durdur" : "Test Et"}
                                    </button>
                                    <div style={{ flex: 1, height: 10, background: '#222', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${micVolume}%`,
                                            height: '100%',
                                            background: '#3ba55c',
                                            transition: 'width 0.1s ease'
                                        }} />
                                    </div>
                                </div>
                                {/* Hidden Audio for Loopback */}
                                <audio ref={testAudioRef} style={{ display: 'none' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ position: 'absolute', top: '20px', right: '40px', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
                SafeZone v1.4.7 (Refactored)
            </div>
        </div>
    );
};

export default SettingsPanel;
