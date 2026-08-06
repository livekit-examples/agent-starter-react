import type { MediaGateDevice, MediaGateDeviceState } from './media-gate-executor';

export type BrowserAudioGateTrack = {
  readonly mediaStreamTrack: {
    enabled: boolean;
    readonly readyState?: MediaStreamTrackState;
  };
  readonly isMuted: boolean;
  mute(): Promise<unknown>;
  unmute(): Promise<unknown>;
};

export type BrowserAudioGateBinding = {
  readonly track: BrowserAudioGateTrack;
  readonly publication: object;
};

export type BrowserAudioGateDeviceOptions = {
  readonly getBinding: () => BrowserAudioGateBinding | null;
  readonly ensurePublishedClosed: (signal: AbortSignal) => Promise<void>;
};

export class BrowserAudioGateDevice implements MediaGateDevice {
  private readonly getBinding: BrowserAudioGateDeviceOptions['getBinding'];
  private readonly ensurePublishedClosed: BrowserAudioGateDeviceOptions['ensurePublishedClosed'];
  private readonly signalingTails = new WeakMap<BrowserAudioGateTrack, Promise<void>>();
  private generation = 0;
  private forcedClosed = true;

  constructor(options: BrowserAudioGateDeviceOptions) {
    this.getBinding = options.getBinding;
    this.ensurePublishedClosed = options.ensurePublishedClosed;
  }

  close(): void {
    this.generation += 1;
    this.forcedClosed = true;
    const binding = this.getBinding();
    if (!binding) return;
    disableCapture(binding);
    this.queueMute(binding);
  }

  async open(signal: AbortSignal): Promise<void> {
    const generation = this.generation;
    throwIfAborted(signal);
    await this.ensurePublishedClosed(signal);
    throwIfAborted(signal);

    const binding = this.getBinding();
    if (!binding) throw new Error('browser audio track is not published');
    const { track } = binding;
    track.mediaStreamTrack.enabled = false;

    try {
      await this.enqueueSignaling(track, async () => {
        this.requireCurrent(binding, generation, signal);
        const unmute = track.unmute();
        // LiveKit may synchronously toggle the underlying MediaStreamTrack. Keep capture
        // closed until both unmute and all cancellation checks have completed.
        track.mediaStreamTrack.enabled = false;
        await unmute;
        track.mediaStreamTrack.enabled = false;
        this.requireCurrent(binding, generation, signal);
      });
      this.forcedClosed = false;
      track.mediaStreamTrack.enabled = true;
      this.requireCurrent(binding, generation, signal);
    } catch (error) {
      disableCapture(binding);
      if (this.generation === generation && this.getBinding()?.track === track) {
        this.forcedClosed = true;
        this.queueMute(binding);
      }
      throw error;
    }
  }

  snapshot(): MediaGateDeviceState {
    const binding = this.getBinding();
    if (!binding) {
      return {
        captureActive: false,
        trackPublished: false,
        trackMuted: true,
      };
    }

    const { track } = binding;
    const captureActive =
      !this.forcedClosed &&
      track.mediaStreamTrack.enabled &&
      track.mediaStreamTrack.readyState !== 'ended';
    return {
      captureActive,
      trackPublished: true,
      trackMuted: this.forcedClosed || track.isMuted || !track.mediaStreamTrack.enabled,
    };
  }

  private requireCurrent(
    binding: BrowserAudioGateBinding,
    generation: number,
    signal: AbortSignal
  ): void {
    throwIfAborted(signal);
    if (this.generation !== generation || this.getBinding()?.track !== binding.track) {
      throw new DOMException('browser audio gate operation was superseded', 'AbortError');
    }
  }

  private queueMute(binding: BrowserAudioGateBinding): void {
    void this.enqueueSignaling(binding.track, async () => {
      disableCapture(binding);
      try {
        await binding.track.mute();
      } catch {
        // Capture was disabled synchronously; LiveKit mute is best effort.
      } finally {
        disableCapture(binding);
      }
    });
  }

  private enqueueSignaling(
    track: BrowserAudioGateTrack,
    operation: () => Promise<void>
  ): Promise<void> {
    const previous = this.signalingTails.get(track) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const settled = result.then(
      () => undefined,
      () => undefined
    );
    this.signalingTails.set(track, settled);
    void settled.then(() => {
      if (this.signalingTails.get(track) === settled) {
        this.signalingTails.delete(track);
      }
    });
    return result;
  }
}

function disableCapture(binding: BrowserAudioGateBinding): void {
  binding.track.mediaStreamTrack.enabled = false;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('browser audio gate operation was aborted', 'AbortError');
  }
}
