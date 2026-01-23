import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { initSocket, destroySocket } from '@/services/socket.service';

interface ReduxProviderProps {
  children: React.ReactNode;
}

/**
 * Redux Provider Wrapper
 * 
 * This component wraps the application with Redux Provider.
 * It's designed to be composed with existing Context providers.
 * Also initializes the socket service for Redux integration.
 */
export function ReduxProvider({ children }: ReduxProviderProps) {
  useEffect(() => {
    // Initialize socket service once at app startup
    // This sets up Redux event listeners but does NOT connect yet
    initSocket();

    // Cleanup on unmount
    return () => {
      destroySocket();
    };
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
