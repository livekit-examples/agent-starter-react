'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { SessionProvider, type UseSessionReturn, useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';

interface ConnectionContextType {
  session?: UseSessionReturn;
  isConnectionActive: boolean;
  connect: (startSession?: boolean) => void;
  disconnect: (endSession?: boolean) => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  session: undefined,
  isConnectionActive: false,
  connect: () => {},
  disconnect: () => {},
});

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return ctx;
}

interface ConnectionProviderProps {
  appConfig: AppConfig;
  children: React.ReactNode;
}

export function ConnectionProvider({ appConfig, children }: ConnectionProviderProps) {
  const [isConnectionActive, setIsConnectionActive] = useState(false);

  const tokenSource = useMemo(() => {
    if (typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string') {
      return TokenSource.custom(async () => {
        const url = new URL(process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT!, window.location.origin);

        try {
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sandbox-Id': appConfig.sandboxId ?? '',
            },
            body: JSON.stringify({
              room_config: appConfig.agentName
                ? {
                    agents: [{ agent_name: appConfig.agentName }],
                  }
                : undefined,
            }),
          });
          return await res.json();
        } catch (error) {
          console.error('Error fetching connection details:', error);
          throw new Error('Error fetching connection details!');
        }
      });
    }

    return TokenSource.endpoint('/api/connection-details');
  }, [appConfig]);

  const sessionOptions = useMemo(
    () => (appConfig.agentName ? { agentName: appConfig.agentName } : undefined),
    [appConfig]
  );

  const session = useSession(tokenSource, sessionOptions);

  const value = useMemo(
    () => ({
      isConnectionActive,
      /**
       * Start the application session and optionally start the agent session.
       *
       * @param startSession - Whether to start the agent session automatically. Default is true.
       * If startSession is passed in asfalse, you are opting to manually start the session.
       */
      connect: (startSession = true) => {
        setIsConnectionActive(true);
        if (startSession) {
          session.start();
        }
      },
      /**
       * End the application session and optionally end the agent session.
       *
       * @param endSession - Whether to end the agent session automatically. Default is true.
       * If endSession is passed in as false, you are opting to manually end the session.
       */
      disconnect: (endSession = true) => {
        setIsConnectionActive(false);
        if (endSession) {
          session.end();
        }
      },
    }),
    // session object is not a stable reference
    // TODO: add session object to dependencies
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [isConnectionActive]
  );

  return (
    <SessionProvider session={session}>
      <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
    </SessionProvider>
  );
}
