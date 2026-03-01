import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'safezone_keybinds';

const DEFAULT_KEYBINDS = {
    ptt: null,     // e.g. 'Space'
    mute: null,    // e.g. 'KeyM'
    deafen: null,  // e.g. 'KeyD'
};

const getFriendlyName = (code) => {
    if (!code) return 'Atanmamış';
    const map = {
        'Space': 'Boşluk',
        'Enter': 'Enter',
        'Escape': 'Escape',
        'Tab': 'Tab',
        'Backspace': 'Geri Al',
        'ShiftLeft': 'Sol Shift',
        'ShiftRight': 'Sağ Shift',
        'ControlLeft': 'Sol Ctrl',
        'ControlRight': 'Sağ Ctrl',
        'AltLeft': 'Sol Alt',
        'AltRight': 'Sağ Alt',
        'CapsLock': 'Caps Lock',
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3).toUpperCase();
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('F')) return code; // F1-F12
    if (code.startsWith('Arrow')) return code.replace('Arrow', '↑↓←→'.includes(code.slice(5)[0]) ? '' : '') + ' Ok';
    return code;
};

export const useKeybinds = () => {
    const [keybinds, setKeybindsState] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? { ...DEFAULT_KEYBINDS, ...JSON.parse(stored) } : DEFAULT_KEYBINDS;
        } catch { return DEFAULT_KEYBINDS; }
    });

    const [isPTTMode, setIsPTTModeState] = useState(() => {
        return localStorage.getItem('safezone_ptt_mode') === 'true';
    });

    const setKeybind = useCallback((action, code) => {
        setKeybindsState(prev => {
            const next = { ...prev, [action]: code };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const clearKeybind = useCallback((action) => {
        setKeybindsState(prev => {
            const next = { ...prev, [action]: null };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const setIsPTTMode = useCallback((val) => {
        setIsPTTModeState(val);
        localStorage.setItem('safezone_ptt_mode', String(val));
    }, []);

    return { keybinds, setKeybind, clearKeybind, isPTTMode, setIsPTTMode, getFriendlyName };
};
