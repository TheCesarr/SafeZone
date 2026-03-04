import { createContext, useContext } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuthContext } from './AuthContext';
import { useUIContext } from './UIContext';
import { useChatContext, roomWsRef } from './ChatContext';

const VoiceContext = createContext(null);

export const VoiceProvider = ({ children }) => {
    const { authState } = useAuthContext();
    const { selectedInputId, selectedOutputId, audioSettings, keybinds, isPTTMode } = useUIContext();
    const { uuid, handleIncomingMessage } = useChatContext();

    const webrtc = useWebRTC(
        authState,
        uuid,
        roomWsRef,
        handleIncomingMessage,
        selectedInputId,
        selectedOutputId,
        audioSettings,
        keybinds,
        isPTTMode
    );

    return <VoiceContext.Provider value={webrtc}>{children}</VoiceContext.Provider>;
};

export const useVoiceContext = () => {
    const ctx = useContext(VoiceContext);
    if (!ctx) throw new Error('useVoiceContext must be used inside <VoiceProvider>');
    return ctx;
};

export default VoiceContext;
