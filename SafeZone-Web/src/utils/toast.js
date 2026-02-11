// Global Toast Manager — works from React hooks AND plain JS files
// Usage: import toast from '../utils/toast'; toast.success("Done!"); toast.error("Oops");

const listeners = new Set();

const toast = {
    _emit(message, type = 'info') {
        listeners.forEach(fn => fn(message, type));
    },
    success(msg) { this._emit(msg, 'success'); },
    error(msg) { this._emit(msg, 'error'); },
    warning(msg) { this._emit(msg, 'warning'); },
    info(msg) { this._emit(msg, 'info'); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export default toast;
