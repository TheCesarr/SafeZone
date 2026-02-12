import { useState, useCallback } from 'react';

export const useUnread = () => {
    const [unreadChannels, setUnreadChannels] = useState(new Set());
    const [unreadDMs, setUnreadDMs] = useState(new Set());

    const markChannelUnread = useCallback((channelId) => {
        setUnreadChannels(prev => {
            const next = new Set(prev);
            next.add(channelId);
            return next;
        });
    }, []);

    const markChannelRead = useCallback((channelId) => {
        setUnreadChannels(prev => {
            const next = new Set(prev);
            next.delete(channelId);
            return next;
        });
    }, []);

    const markDMUnread = useCallback((username) => {
        setUnreadDMs(prev => {
            const next = new Set(prev);
            next.add(username);
            return next;
        });
    }, []);

    const markDMRead = useCallback((username) => {
        setUnreadDMs(prev => {
            const next = new Set(prev);
            next.delete(username);
            return next;
        });
    }, []);

    return {
        unreadChannels,
        unreadDMs,
        markChannelUnread,
        markChannelRead,
        markDMUnread,
        markDMRead
    };
};
