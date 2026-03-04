import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useToast } from '../hooks/useToast';
import { useUnread } from '../hooks/useUnread';
import { useKeybinds } from '../hooks/useKeybinds';
import { getTheme } from '../utils/themes';

const UIContext = createContext(null);

export const UIProvider = ({ children }) => {
    // Toast
    const { toasts, showToast, removeToast } = useToast();

    // Unread tracking
    const unread = useUnread();

    // Keybinds
    const { keybinds, setKeybind, clearKeybind, isPTTMode, setIsPTTMode, getFriendlyName } = useKeybinds();

    // Theme
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('safezone_theme');
        if (saved) { try { return JSON.parse(saved); } catch (e) { } }
        return { palette: 'midnight', mode: 'dark' };
    });

    const colors = useMemo(() => getTheme(theme.palette, theme.mode), [theme]);

    useEffect(() => {
        document.body.style.backgroundColor = colors.background;
        document.body.style.color = colors.text;
    }, [colors]);

    // Command Palette
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(p => !p);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    // Audio Devices
    const [inputDevices, setInputDevices] = useState([]);
    const [outputDevices, setOutputDevices] = useState([]);
    const [selectedInputId, setSelectedInputId] = useState('default');
    const [selectedOutputId, setSelectedOutputId] = useState('default');
    const [audioSettings, setAudioSettings] = useState({
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
    });

    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const inputs = devices.filter(d => d.kind === 'audioinput');
                const outputs = devices.filter(d => d.kind === 'audiooutput');
                setInputDevices(inputs);
                setOutputDevices(outputs);
                if (selectedInputId === 'default' && inputs.length > 0 && !inputs.find(d => d.deviceId === 'default')) {
                    setSelectedInputId(inputs[0].deviceId);
                }
                if (selectedOutputId === 'default' && outputs.length > 0 && !outputs.find(d => d.deviceId === 'default')) {
                    setSelectedOutputId(outputs[0].deviceId);
                }
            } catch (e) { console.error('Device enumeration error:', e); }
        };
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const value = {
        // Toast
        toasts, showToast, removeToast,
        // Unread
        unread,
        // Keybinds
        keybinds, setKeybind, clearKeybind, isPTTMode, setIsPTTMode, getFriendlyName,
        // Theme
        theme, setTheme, colors,
        // Command Palette
        showCommandPalette, setShowCommandPalette,
        // Devices
        inputDevices, outputDevices,
        selectedInputId, setSelectedInputId,
        selectedOutputId, setSelectedOutputId,
        audioSettings, setAudioSettings,
    };

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUIContext = () => {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useUIContext must be used inside <UIProvider>');
    return ctx;
};

export default UIContext;
