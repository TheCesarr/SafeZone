import { createContext, useContext } from 'react';
import { useLobby } from '../hooks/useLobby';
import { useAuthContext } from './AuthContext';
import { useUIContext } from './UIContext';
import { useServerContext } from './ServerContext';
import { useChatContext } from './ChatContext';

const LobbyContext = createContext(null);

export const LobbyProvider = ({ children }) => {
    const { authState } = useAuthContext();
    const { unread, showToast } = useUIContext();
    const { fetchServers, fetchFriends, setServerMembers } = useServerContext();
    const { uuid } = useChatContext();

    // Update serverMembers when online users change
    const updateGlobalUsers = (usersArray) => {
        if (!usersArray) return;
        setServerMembers(prev => {
            let changed = false;
            const next = prev.map(m => {
                const up = usersArray.find(u => u.username === m.username);
                if (up) {
                    if (
                        m.avatar_url !== up.avatar_url ||
                        m.display_name !== up.display_name ||
                        m.avatar_color !== up.avatar_color ||
                        m.status !== up.status ||
                        m.custom_status !== up.custom_status
                    ) {
                        changed = true;
                        return { ...m, ...up };
                    }
                }
                return m;
            });
            return changed ? next : prev;
        });
    };

    const lobby = useLobby(
        authState,
        uuid,
        fetchServers,
        (sender, disc) => {
            showToast(`${sender}#${disc} sana arkadaşlık isteği gönderdi!`, 'info');
            fetchFriends();
        },
        (sender) => {
            unread.markDMUnread(sender);
        },
        updateGlobalUsers
    );

    return <LobbyContext.Provider value={lobby}>{children}</LobbyContext.Provider>;
};

export const useLobbyContext = () => {
    const ctx = useContext(LobbyContext);
    if (!ctx) throw new Error('useLobbyContext must be used inside <LobbyProvider>');
    return ctx;
};

export default LobbyContext;
