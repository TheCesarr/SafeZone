import { useState, useEffect, useCallback, useRef } from 'react';
import toast from '../utils/toast';

let globalToastId = 0;

export function useToast() {
    const [toasts, setToasts] = useState([]);
    const toastsRef = useRef([]);

    const removeToast = useCallback((id) => {
        toastsRef.current = toastsRef.current.filter(t => t.id !== id);
        setToasts([...toastsRef.current]);
    }, []);

    const showToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++globalToastId;
        const newToast = { id, message, type, exiting: false };
        toastsRef.current = [...toastsRef.current, newToast];
        setToasts([...toastsRef.current]);

        setTimeout(() => {
            toastsRef.current = toastsRef.current.map(t =>
                t.id === id ? { ...t, exiting: true } : t
            );
            setToasts([...toastsRef.current]);
            setTimeout(() => removeToast(id), 300);
        }, duration);

        return id;
    }, [removeToast]);

    // Subscribe to global toast events
    useEffect(() => {
        const unsub = toast.subscribe((message, type) => {
            showToast(message, type);
        });
        return unsub;
    }, [showToast]);

    return { toasts, showToast, removeToast };
}
