import React, { useState } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { useUIContext } from './contexts/UIContext';
import AppLayout from './AppLayout';

/**
 * AppRoot — decides what to render based on auth state:
 *   1. Loading spinner (checking admin/token)
 *   2. Login screen (not authenticated)
 *   3. Main app layout (authenticated)
 */
const AppRoot = () => {
    const {
        authState, authMode, setAuthMode, authError,
        handleLogin, handleRegister, handleResetPassword,
        isCheckingAdmin,
    } = useAuthContext();

    const { colors } = useUIContext();

    const [authInput, setAuthInput] = useState({
        email: '', username: '', password: '', display_name: '', recovery_pin: ''
    });

    const handleAuthSubmit = () => {
        if (authMode === 'login') handleLogin(authInput.email, authInput.password);
        else if (authMode === 'register') handleRegister(authInput.username, authInput.email, authInput.password, authInput.display_name, authInput.recovery_pin);
        else if (authMode === 'reset') handleResetPassword(authInput.email, authInput.recovery_pin, authInput.password);
    };

    // 1. Loading spinner
    if (isCheckingAdmin) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#2f3136', color: '#fff', flexDirection: 'column', gap: 20, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontSize: 40 }}>🛡️</div>
                <h2>SafeZone Başlatılıyor...</h2>
                <p style={{ color: '#b9bbbe' }}>Sistem kontrol ediliyor...</p>
            </div>
        );
    }

    // 2. Login screen
    if (!authState.token) {
        return (
            <div style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }} />
                <div style={{ width: '480px', padding: '32px', background: colors.card, borderRadius: '5px', zIndex: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    <h2 style={{ color: colors.text, marginBottom: '20px', textAlign: 'center', fontSize: '28px' }}>SafeZone v2.0</h2>
                    <h3 style={{ color: '#b9bbbe', marginBottom: '20px', textAlign: 'center', fontSize: '18px' }}>
                        {authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Hesap Oluştur' : 'Şifre Sıfırla'}
                    </h3>

                    {authError && <div style={{ color: '#ed4245', marginBottom: 15, padding: '10px', background: 'rgba(237,66,69,0.1)', borderRadius: '3px', border: '1px solid #ed4245' }}>{authError}</div>}

                    {authMode === 'reset' && (
                        <>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>E-POSTA</label>
                                <input type="email" value={authInput.email} onChange={e => setAuthInput({ ...authInput, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KURTARMA PIN (4 Haneli)</label>
                                <input type="text" maxLength="4" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>YENİ ŞİFRE</label>
                                <input type="password" value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                        </>
                    )}

                    {authMode === 'login' && (
                        <>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>E-POSTA</label>
                                <input type="email" value={authInput.email} onChange={e => setAuthInput({ ...authInput, email: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>ŞİFRE</label>
                                <input type="password" value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                        </>
                    )}

                    {authMode === 'register' && (
                        <>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>E-POSTA (*)</label>
                                <input type="email" value={authInput.email} onChange={e => setAuthInput({ ...authInput, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KULLANICI ADI (*)</label>
                                <input type="text" value={authInput.username} onChange={e => setAuthInput({ ...authInput, username: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>GÖRÜNEN İSİM</label>
                                <input type="text" value={authInput.display_name} onChange={e => setAuthInput({ ...authInput, display_name: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>ŞİFRE (*)</label>
                                <input type="password" value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KURTARMA PIN (4 Haneli - Şifre Sıfırlama İçin)</label>
                                <input type="text" maxLength="4" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
                            </div>
                        </>
                    )}

                    <button onClick={handleAuthSubmit} style={{ width: '100%', padding: 10, background: colors.accent, color: '#fff', border: 'none', borderRadius: 3, fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                        {authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Kayıt Ol' : 'Şifreyi Sıfırla'}
                    </button>

                    <div style={{ marginTop: 20, fontSize: 14, color: '#72767d', textAlign: 'center' }}>
                        {authMode === 'login' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <span>Hesabın yok mu? <span onClick={() => setAuthMode('register')} style={{ color: colors.accent, cursor: 'pointer', fontWeight: 'bold' }}>Kaydol</span></span>
                                <span onClick={() => setAuthMode('reset')} style={{ fontSize: 12, color: colors.accent, cursor: 'pointer' }}>Şifremi Unuttum</span>
                            </div>
                        ) : authMode === 'register' ? (
                            <>Zaten hesabın var mı? <span onClick={() => setAuthMode('login')} style={{ color: colors.accent, cursor: 'pointer', fontWeight: 'bold' }}>Giriş Yap</span></>
                        ) : (
                            <>Hatırladın mı? <span onClick={() => setAuthMode('login')} style={{ color: colors.accent, cursor: 'pointer', fontWeight: 'bold' }}>Giriş Yap</span></>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 3. Main app
    return <AppLayout />;
};

export default AppRoot;
