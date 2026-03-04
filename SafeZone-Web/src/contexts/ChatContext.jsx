import { createContext, useContext, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useChat } from '../hooks/useChat';
import { useAuthContext } from './AuthContext';
import { useUIContext } from './UIContext';
import { useServerContext } from './ServerContext';

const ChatContext = createContext(null);

// Shared WebSocket refs — created once, shared across Chat and Voice providers
export const chatWsRef = { current: null };
export const roomWsRef = { current: null };

export const ChatProvider = ({ children }) => {
    const { authState } = useAuthContext();
    const { unread } = useUIContext();
    const { selectedChannel } = useServerContext();

    const uuid = useRef(localStorage.getItem('safezone_uuid') || uuidv4());
    const selectedChannelRef = useRef(null);

    const chat = useChat(
        authState,
        uuid,
        chatWsRef,
        roomWsRef,
        () => {
            if (selectedChannelRef.current) {
                unread.incrementChannelUnread(selectedChannelRef.current.id);
            }
        }
    );

    // Keep selectedChannelRef in sync
    if (selectedChannel) selectedChannelRef.current = selectedChannel;

    const value = {
        ...chat,
        uuid,
        selectedChannelRef,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChatContext must be used inside <ChatProvider>');
    return ctx;
};

export default ChatContext;
