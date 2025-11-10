'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { SessionProvider, type UseSessionReturn, useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';

interface AppSessionContextType {
  session?: UseSessionReturn;
  isSessionActive: boolean;
  startSession: (startSession?: boolean) => void;
  endSession: (endSession?: boolean) => void;
}

const AppSessionContext = createContext<AppSessionContextType>({
  session: undefined,
  isSessionActive: false,
  startSession: () => {},
  endSession: () => {},
});

export function useAppSession() {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error('useAppSession must be used within a AppSessionProvider');
  }
  return ctx;
}

interface AppSessionProviderProps {
  appConfig: AppConfig;
  children: React.ReactNode;
}

export function AppSessionProvider({ appConfig, children }: AppSessionProviderProps) {
  const [isSessionActive, setIsSessionActive] = useState(false);

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
      isSessionActive,
      /**
       * Start the application session and optionally start the agent session.
       *
       * @param startSession - Whether to start the agent session automatically. Default is true.
       * If startSession is passed in asfalse, you are opting to manually start the session.
       */
      startSession: (startSession = true) => {
        setIsSessionActive(true);
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
      endSession: (endSession = true) => {
        setIsSessionActive(false);
        if (endSession) {
          session.end();
        }
      },
    }),
    // session object is not a stable reference
    // TODO: add session object to dependencies
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [isSessionActive]
  );

  return (
    <SessionProvider session={session}>
      <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>
    </SessionProvider>
  );
}
