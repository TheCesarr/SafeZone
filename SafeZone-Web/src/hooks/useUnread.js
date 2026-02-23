import { useState, useCallback } from 'react';

export const useUnread = () => {
    // Map<channelId, count> for per-channel unread counts
    const [unreadChannels, setUnreadChannels] = useState(new Map());
    const [unreadDMs, setUnreadDMs] = useState(new Set());

    const incrementChannelUnread = useCallback((channelId) => {
        if (!channelId) return;
        setUnreadChannels(prev => {
            const next = new Map(prev);
            next.set(channelId, (next.get(channelId) || 0) + 1);
            return next;
        });
    }, []);

    const markChannelRead = useCallback((channelId) => {
        setUnreadChannels(prev => {
            const next = new Map(prev);
            next.delete(channelId);
            return next;
        });
    }, []);

    // Legacy: check if channel has any unread (used in ChannelList)
    const hasUnread = useCallback((channelId) => {
        return unreadChannels.has(channelId);
    }, [unreadChannels]);

    const getUnreadCount = useCallback((channelId) => {
        return unreadChannels.get(channelId) || 0;
    }, [unreadChannels]);

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
        unreadChannels,    // Map<channelId, count>
        unreadDMs,         // Set<username>
        incrementChannelUnread,
        markChannelRead,
        markChannelUnread: incrementChannelUnread, // backwards compat alias
        hasUnread,
        getUnreadCount,
        markDMUnread,
        markDMRead
    };
};
