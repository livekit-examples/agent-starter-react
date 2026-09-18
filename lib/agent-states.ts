import type { AgentState } from '@livekit/components-react';

/**
 * Russian labels for every seat of the LiveKit agent state machine.
 * Used by the in-call status pill and error surfaces.
 */
export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  disconnected: 'Нет соединения',
  connecting: 'Подключение…',
  'pre-connect-buffering': 'Подготовка…',
  failed: 'Ошибка',
  initializing: 'Инициализация…',
  idle: 'Ожидание',
  listening: 'Слушает…',
  thinking: 'Думает…',
  speaking: 'Говорит…',
};

export const THINKING_TEXT = 'Думает…';

export const CONNECTING_TEXT = 'Подключение…';

export const AGENT_AVATAR_LABEL = 'Агент';
