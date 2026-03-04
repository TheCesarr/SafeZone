import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const auth = useAuth();

    // Build type (client vs admin)
    const [buildType, setBuildType] = useState('client');
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
    const [adminView, setAdminView] = useState(true);

    useEffect(() => {
        if (window.SAFEZONE_API) {
            window.SAFEZONE_API.getBuildType().then(t => setBuildType(t));
        }
    }, []);

    // Admin auto-login
    useEffect(() => {
        const checkAdmin = async () => {
            if (window.SAFEZONE_API) {
                try {
                    await new Promise(r => setTimeout(r, 500));
                    const type = await window.SAFEZONE_API.getBuildType();
                    if (type === 'admin') {
                        const secret = await window.SAFEZONE_API.getAdminSecret();
                        if (secret) {
                            await auth.handleAdminLogin(secret);
                            // Force sysadmin flag as failsafe
                            if (auth.authState.user) auth.authState.user.is_sysadmin = true;
                        }
                    }
                } catch (e) {
                    console.error('Admin check error:', e);
                }
            }
            setIsCheckingAdmin(false);
        };

        if (!auth.authState.token) {
            checkAdmin();
        } else {
            setIsCheckingAdmin(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const value = {
        ...auth,
        buildType,
        isCheckingAdmin,
        adminView,
        setAdminView,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
    return ctx;
};

export default AuthContext;
