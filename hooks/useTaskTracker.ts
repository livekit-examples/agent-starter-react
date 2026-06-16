'use client';

import { useEffect, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

// Reply lifecycle for a single timeline entry.
//  inline       - voiced as part of the turn that called the tool (the first update)
//  pending      - buffered, waiting for the session to go idle
//  scheduled    - the deferred reply was created and queued to speak
//  completed    - voiced to the user
//  interrupted  - the reply was interrupted before finishing
//  skipped      - the agent skipped it as already said
export type ReplyState =
  | 'inline'
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'interrupted'
  | 'skipped';

export interface TimelineEntry {
  id: string;
  kind: 'update' | 'result';
  text: string;
  reply: ReplyState;
  ts: number;
}

export interface Task {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error' | 'cancelled';
  timeline: TimelineEntry[];
  result: string | null;
  error: string | null;
  started_at: number;
  ended_at: number | null;
}

// data topic carrying the agent's ToolExecutionUpdatedEvent JSON (see async_tool_agent.py)
const TOPIC = 'tool_status';

// shape of the events the agent publishes (ToolExecutionUpdatedEvent.model_dump_json)
type ToolExecutionEvent = {
  update:
    | {
        type: 'tool_call_started';
        function_call: { call_id: string; name: string; arguments: string };
      }
    | {
        type: 'tool_call_updated';
        id: string;
        call_id: string;
        message: string;
      }
    | {
        type: 'tool_call_ended';
        id: string;
        call_id: string;
        message: string | null;
        status: 'done' | 'error' | 'cancelled';
      }
    | { type: 'tool_reply_updated'; update_ids: string[]; status: ReplyState };
  created_at: number;
};

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
  } catch {
    return {};
  }
}

/**
 * Subscribes to the agent's tool status events on the `tool_status` data topic and folds
 * them into per-tool tasks the UI renders. The agent streams individual events; this hook
 * accumulates them, so a frontend that joins mid-call only sees tasks from when it connected.
 */
export function useTaskTracker(): Task[] {
  const room = useRoomContext();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!room) return;

    // call_id -> Task, kept in start order
    const byId = new Map<string, Task>();
    const emit = () =>
      setTasks([...byId.values()].map((t) => ({ ...t, timeline: [...t.timeline] })));

    const findEntry = (entryId: string): TimelineEntry | undefined => {
      for (const task of byId.values()) {
        const entry = task.timeline.find((e) => e.id === entryId);
        if (entry) return entry;
      }
      return undefined;
    };

    const apply = (ev: ToolExecutionEvent) => {
      const u = ev.update;
      if (u.type === 'tool_call_started') {
        byId.set(u.function_call.call_id, {
          id: u.function_call.call_id,
          name: u.function_call.name,
          args: parseArgs(u.function_call.arguments),
          status: 'running',
          timeline: [],
          result: null,
          error: null,
          started_at: ev.created_at,
          ended_at: null,
        });
      } else if (u.type === 'tool_call_updated') {
        const task = byId.get(u.call_id);
        if (!task) return;
        // first update keeps the plain call_id and is voiced inline; later ones are deferred
        task.timeline.push({
          id: u.id,
          kind: 'update',
          text: u.message,
          reply: u.id === u.call_id ? 'inline' : 'pending',
          ts: ev.created_at,
        });
      } else if (u.type === 'tool_call_ended') {
        const task = byId.get(u.call_id);
        if (!task) return;
        task.status = u.status;
        task.ended_at = ev.created_at;
        if (u.status === 'error') task.error = u.message;
        else if (u.status === 'done') task.result = u.message;
        // a terminal entry with a deferred id (_final) is voiced as a reply
        if (u.message && u.id !== u.call_id) {
          task.timeline.push({
            id: u.id,
            kind: 'result',
            text: u.message,
            reply: 'pending',
            ts: ev.created_at,
          });
        }
      } else if (u.type === 'tool_reply_updated') {
        for (const entryId of u.update_ids) {
          const entry = findEntry(entryId);
          if (entry) entry.reply = u.status;
        }
      }
      emit();
    };

    const decoder = new TextDecoder();
    const onData = (payload: Uint8Array, _p: unknown, _k: unknown, topic?: string) => {
      if (topic !== TOPIC) return;
      try {
        apply(JSON.parse(decoder.decode(payload)) as ToolExecutionEvent);
      } catch {
        // ignore malformed events
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  return tasks;
}
