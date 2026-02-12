import { useState, useEffect } from 'react';
import { getUrl } from '../utils/api';
import { useToast } from './useToast'; // Correct import if needed, assuming useToast handles its own import or passed via context. actually App.jsx passes it? No App.jsx uses it.
// Wait, useAuth doesn't use useToast in the original code, it imports `toast` from utils.
import toast from '../utils/toast';

export const useAuth = () => {
    // State
    const [authState, setAuthState] = useState({ token: null, user: null });
    const [authMode, setAuthMode] = useState('login'); // login | register | reset
    const [authError, setAuthError] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Initial load check

    // Check Local Storage on Mount
    useEffect(() => {
        const checkToken = async () => {
            const storedToken = localStorage.getItem('safezone_token');
            if (storedToken) {
                try {
                    const res = await fetch(getUrl('/auth/verify', 'http'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: storedToken })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        setAuthState({
                            token: storedToken,
                            user: {
                                username: data.username,
                                display_name: data.display_name,
                                discriminator: data.discriminator,
                                email: data.email,
                                is_sysadmin: data.is_sysadmin
                            }
                        });
                    } else {
                        localStorage.removeItem('safezone_token');
                    }
                } catch (e) { console.error("Verify Error", e); }
            }
            setIsLoading(false);
        }
        checkToken();
    }, []);

    const handleLogin = async (email, password) => {
        setAuthError(null);
        try {
            const res = await fetch(getUrl('/auth/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.status === 'success') {
                localStorage.setItem('safezone_token', data.token);
                setAuthState({
                    token: data.token,
                    user: {
                        username: data.username,
                        display_name: data.display_name,
                        discriminator: data.discriminator,
                        email: data.email,
                        is_sysadmin: data.is_sysadmin
                    }
                });
            } else {
                setAuthError(data.message);
            }
        } catch (err) {
            setAuthError('Sunucu bağlantı hatası!');
            console.error(err);
        }
    }

    const handleRegister = async (username, email, password, displayName, pin) => {
        setAuthError(null);
        try {
            const res = await fetch(getUrl('/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    display_name: displayName,
                    recovery_pin: pin
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                localStorage.setItem('safezone_token', data.token);
                setAuthState({
                    token: data.token,
                    user: {
                        username: data.username,
                        display_name: data.display_name,
                        discriminator: data.discriminator,
                        email: data.email,
                        is_sysadmin: false // Default false
                    }
                });
            } else {
                setAuthError(data.message);
            }
        } catch (err) {
            setAuthError('Kayıt hatası!');
            console.error(err);
        }
    }

    const handleResetPassword = async (email, pin, newPassword) => {
        setAuthError(null);
        try {
            const res = await fetch(getUrl('/auth/reset'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    recovery_pin: pin,
                    new_password: newPassword
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setAuthError(null);
                toast.success(data.message);
                setAuthMode('login'); // Switch back to login
            } else {
                setAuthError(data.message);
            }
        } catch (err) {
            setAuthError('Sıfırlama hatası!');
            console.error(err);
        }
    }

    const handleAdminLogin = async (secret) => {
        setAuthError(null);
        try {
            const res = await fetch(getUrl('/auth/admin-login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret })
            });
            const data = await res.json();
            if (data.status === 'success') {
                localStorage.setItem('safezone_token', data.token);
                setAuthState({
                    token: data.token,
                    user: {
                        username: data.username,
                        display_name: data.display_name,
                        discriminator: data.discriminator,
                        email: data.email,
                        is_sysadmin: true // FORCE TRUE for Admin Login
                    }
                });
            } else {
                setAuthError(data.message);
            }
        } catch (err) {
            setAuthError('Admin Giriş Hatası!');
            console.error(err);
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('safezone_token');
        setAuthState({ token: null, user: null });
        window.location.reload(); // Cleanest restart
    }

    return {
        authState,
        authMode, setAuthMode,
        authError, setAuthError,
        isLoading,
        handleLogin,
        handleRegister,
        handleResetPassword,
        handleLogout,
        handleAdminLogin
    };
}
