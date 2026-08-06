import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client';
import {
  MEDIA_CONTROL_TOPIC,
  MEDIA_STATE_TOPIC,
  type MediaControlCommand,
  type MediaStateSnapshot,
  decodeMediaControl,
  encodeMediaState,
} from './media-control-protocol';

export type MediaGateExecutorPort = {
  start(): Promise<void>;
  bindController(controllerIdentity: string): Promise<void>;
  handleCommand(controllerIdentity: string, command: MediaControlCommand): Promise<void>;
  handleMalformedControl(controllerIdentity: string, errorCode: string): Promise<void>;
  disconnectController(controllerIdentity: string): Promise<void>;
  stop(): Promise<void>;
};

export type MediaStatePublisher = (
  controllerIdentity: string,
  state: MediaStateSnapshot,
  signal: AbortSignal
) => Promise<void>;

export type LiveKitMediaGateAdapterOptions = {
  readonly room: Room;
  readonly agentName: string;
  readonly allowAnonymousLiveKitAgentFallback?: boolean;
  readonly onError?: (error: unknown) => void;
};

export class LiveKitMediaGateAdapter {
  private readonly room: Room;
  private readonly agentName: string;
  private readonly allowAnonymousLiveKitAgentFallback: boolean;
  private readonly onError: ((error: unknown) => void) | undefined;

  private executor: MediaGateExecutorPort | null = null;
  private controllerIdentity: string | null = null;
  private started = false;
  private stopped = false;
  private eventTail: Promise<void> = Promise.resolve();
  private readonly ownedTasks = new Set<Promise<void>>();

  constructor(options: LiveKitMediaGateAdapterOptions) {
    if (!options.agentName) throw new Error('agentName must be non-empty');
    this.room = options.room;
    this.agentName = options.agentName;
    this.allowAnonymousLiveKitAgentFallback = options.allowAnonymousLiveKitAgentFallback ?? false;
    this.onError = options.onError;
  }

  async start(executor: MediaGateExecutorPort): Promise<void> {
    if (this.stopped) throw new Error('LiveKit media gate adapter cannot restart after stop');
    if (this.started) {
      if (this.executor !== executor) {
        throw new Error('LiveKit media gate adapter is already bound to an executor');
      }
      return this.drain();
    }

    await executor.start();
    this.executor = executor;
    this.started = true;
    this.room.on(RoomEvent.DataReceived, this.handleDataReceived);
    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
    try {
      await this.discoverAndBindController();
    } catch (startError) {
      this.started = false;
      this.stopped = true;
      this.controllerIdentity = null;
      this.removeListeners();
      try {
        await Promise.all([executor.stop(), this.drain()]);
      } catch (cleanupError) {
        this.executor = null;
        throw new AggregateError(
          [startError, cleanupError],
          'LiveKit media gate adapter start and cleanup failed'
        );
      }
      this.executor = null;
      throw startError;
    }
  }

  readonly publishState: MediaStatePublisher = async (controllerIdentity, state, signal) => {
    throwIfAborted(signal);
    if (!this.started || this.stopped || controllerIdentity !== this.controllerIdentity) return;
    await publishLiveKitMediaState(this.room, controllerIdentity, state, signal);
  };

  async stop(): Promise<void> {
    if (this.stopped) return this.drain();
    this.stopped = true;
    this.started = false;
    this.removeListeners();

    const executor = this.executor;
    this.controllerIdentity = null;
    const stopPromise = executor?.stop() ?? Promise.resolve();
    await Promise.all([stopPromise, this.drain()]);
    this.executor = null;
  }

  async drain(): Promise<void> {
    while (true) {
      const eventTail = this.eventTail;
      const tasks = [...this.ownedTasks];
      await Promise.all([eventTail, ...tasks]);
      if (eventTail === this.eventTail && this.ownedTasks.size === 0) return;
    }
  }

  private readonly handleDataReceived = (
    payload: Uint8Array,
    participant?: RemoteParticipant,
    _kind?: unknown,
    topic?: string
  ): void => {
    if (topic !== MEDIA_CONTROL_TOPIC) return;
    const controllerIdentity = this.controllerIdentity;
    if (
      !this.started ||
      this.stopped ||
      !participant?.isAgent ||
      !controllerIdentity ||
      participant.identity !== controllerIdentity
    ) {
      return;
    }

    this.trackEvent(async () => {
      const executor = this.executor;
      if (
        !executor ||
        !this.started ||
        this.stopped ||
        this.controllerIdentity !== controllerIdentity
      ) {
        return;
      }
      let command: MediaControlCommand;
      try {
        command = decodeMediaControl(payload);
      } catch (error) {
        await executor.handleMalformedControl(controllerIdentity, mediaControlErrorCode(error));
        return;
      }
      await executor.handleCommand(controllerIdentity, command);
    });
  };

  private readonly handleParticipantConnected = (): void => {
    this.trackEvent(() => this.discoverAndBindController());
  };

  private readonly handleParticipantDisconnected = (participant: RemoteParticipant): void => {
    if (participant.identity !== this.controllerIdentity) return;
    this.controllerIdentity = null;
    const executor = this.executor;
    if (!executor) return;
    this.trackOwned(
      Promise.resolve().then(() => executor.disconnectController(participant.identity))
    );
  };

  private async discoverAndBindController(): Promise<void> {
    if (!this.started || this.stopped || this.controllerIdentity) return;
    const executor = this.executor;
    if (!executor) return;

    const participant = findTrustedController(
      [...this.room.remoteParticipants.values()],
      this.agentName,
      this.allowAnonymousLiveKitAgentFallback
    );
    if (!participant) return;

    this.controllerIdentity = participant.identity;
    try {
      await executor.bindController(participant.identity);
    } catch (error) {
      if (this.controllerIdentity === participant.identity) this.controllerIdentity = null;
      throw error;
    }
  }

  private trackEvent(action: () => Promise<void>): void {
    const next = this.eventTail.then(async () => {
      if (!this.started || this.stopped) return;
      await action();
    });
    this.eventTail = this.trackOwned(next);
  }

  private trackOwned(task: Promise<void>): Promise<void> {
    const observed = task.catch((error: unknown) => {
      try {
        this.onError?.(error);
      } catch {
        // The adapter owns event promises; a diagnostic callback must not create a rejection.
      }
    });
    this.ownedTasks.add(observed);
    void observed.then(() => {
      this.ownedTasks.delete(observed);
    });
    return observed;
  }

  private removeListeners(): void {
    this.room.off(RoomEvent.DataReceived, this.handleDataReceived);
    this.room.off(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.off(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
  }
}

export async function publishLiveKitMediaState(
  room: Room,
  controllerIdentity: string,
  state: MediaStateSnapshot,
  signal: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  const payload = encodeMediaState(state);
  throwIfAborted(signal);
  await room.localParticipant.publishData(payload, {
    reliable: true,
    destinationIdentities: [controllerIdentity],
    topic: MEDIA_STATE_TOPIC,
  });
}

function mediaControlErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.includes('schema_version') &&
    error.message.includes('not supported')
  ) {
    return 'unsupported_control_version';
  }
  return 'malformed_control';
}

function findTrustedController(
  participants: readonly RemoteParticipant[],
  agentName: string,
  allowAnonymousLiveKitAgentFallback: boolean
): RemoteParticipant | null {
  const expected = participants.find(
    (participant) => participant.isAgent && readAgentName(participant) === agentName
  );
  if (expected) return expected;
  if (!allowAnonymousLiveKitAgentFallback) return null;

  const anonymousAgents = participants.filter(
    (participant) =>
      participant.isAgent &&
      participant.identity.startsWith('agent-') &&
      !readAgentName(participant)
  );
  return anonymousAgents.length === 1 ? anonymousAgents[0] : null;
}

function readAgentName(participant: RemoteParticipant): string {
  const attributes = participant.attributes;
  return attributes['lk.agent.name'] || attributes['lk.agent_name'] || attributes.lkAgentName || '';
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('media state publish aborted', 'AbortError');
}
