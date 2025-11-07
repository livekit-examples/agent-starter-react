import { useEffect } from 'react';
import { type AgentState, useVoiceAssistant } from '@livekit/components-react';
import { toastAlert } from '@/components/livekit/alert-toast';
import { useAppSession } from '@/hooks/useAppSession';

function isAgentAvailable(agentState: AgentState) {
  return agentState == 'listening' || agentState == 'thinking' || agentState == 'speaking';
}

export function useConnectionTimeout(timout = 20_000) {
  const { endSession } = useAppSession();
  const { state: agentState } = useVoiceAssistant();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isAgentAvailable(agentState)) {
        const reason =
          agentState === 'connecting'
            ? 'Agent did not join the room. '
            : 'Agent connected but did not complete initializing. ';

        toastAlert({
          title: 'Session ended',
          description: (
            <p className="w-full">
              {reason}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.livekit.io/agents/start/voice-ai/"
                className="whitespace-nowrap underline"
              >
                See quickstart guide
              </a>
              .
            </p>
          ),
        });

        endSession();
      }
    }, timout);

    return () => clearTimeout(timeout);
  }, [agentState, endSession, timout]);
}
