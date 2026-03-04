import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { ServerProvider } from './contexts/ServerContext';
import { ChatProvider } from './contexts/ChatContext';
import { VoiceProvider } from './contexts/VoiceContext';
import { LobbyProvider } from './contexts/LobbyContext';
import { initServerUrl } from './utils/api';

/**
 * AppProviders — nests all context providers in dependency order:
 *
 *   Auth → UI → Server → Chat → Voice → Lobby
 *
 * Each provider can safely consume all providers above it.
 * Components only subscribe to the contexts they need,
 * preventing cascading re-renders from unrelated state.
 *
 * initServerUrl() is called once here so the server URL is resolved
 * from server-config.json (via Electron IPC) before any API call is made.
 */
const AppProviders = ({ children }) => {
    useEffect(() => {
        initServerUrl();
    }, []);

    return (
        <AuthProvider>
            <UIProvider>
                <ServerProvider>
                    <ChatProvider>
                        <VoiceProvider>
                            <LobbyProvider>
                                {children}
                            </LobbyProvider>
                        </VoiceProvider>
                    </ChatProvider>
                </ServerProvider>
            </UIProvider>
        </AuthProvider>
    );
};

export default AppProviders;
