import { createContext, useContext } from 'react';
import { useServerData } from '../hooks/useServerData';
import { useAuthContext } from './AuthContext';

const ServerContext = createContext(null);

export const ServerProvider = ({ children }) => {
    const { authState } = useAuthContext();
    const serverData = useServerData(authState);

    return (
        <ServerContext.Provider value={serverData}>
            {children}
        </ServerContext.Provider>
    );
};

export const useServerContext = () => {
    const ctx = useContext(ServerContext);
    if (!ctx) throw new Error('useServerContext must be used inside <ServerProvider>');
    return ctx;
};

export default ServerContext;
