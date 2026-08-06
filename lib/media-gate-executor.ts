import {
  MEDIA_STATE_TOPIC,
  type MediaControlCommand,
  type MediaStateSnapshot,
} from './media-control-protocol';

export type MediaGateDeviceState = {
  readonly captureActive: boolean;
  readonly trackPublished: boolean;
  readonly trackMuted: boolean;
};

export type MediaGateDevice = {
  close(): void;
  open(signal: AbortSignal): Promise<void>;
  snapshot(): MediaGateDeviceState;
};

export type MediaGateScheduler = {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type MediaGateExecutorOptions = {
  readonly targetIdentity: string;
  readonly device: MediaGateDevice;
  readonly publishState: (
    controllerIdentity: string,
    state: MediaStateSnapshot,
    signal: AbortSignal
  ) => Promise<void>;
  readonly uuid: () => string;
  readonly nowUnixMs: () => number;
  readonly nowMonotonicMs: () => number;
  readonly scheduler: MediaGateScheduler;
  readonly maxOpenLeaseMs: number;
};

type CommandStatus = NonNullable<MediaStateSnapshot['command_status']>;

type CommandResult = {
  readonly command: MediaControlCommand;
  status: CommandStatus | null;
  errorCode: string | null;
};

type OpenLease = {
  readonly id: number;
  readonly deadlineMonotonicMs: number;
  readonly command: MediaControlCommand;
  timer: unknown;
};

const NULL_CORRELATION = {
  command_id: null,
  policy_epoch: null,
  command_sequence: null,
  command_status: null,
} as const;
const MAX_RETIRED_POLICY_EPOCHS = 16;

export class MediaGateExecutor {
  private readonly targetIdentity: string;
  private readonly device: MediaGateDevice;
  private readonly publishStateSink: MediaGateExecutorOptions['publishState'];
  private readonly nowUnixMs: () => number;
  private readonly nowMonotonicMs: () => number;
  private readonly scheduler: MediaGateScheduler;
  private readonly maxOpenLeaseMs: number;
  private readonly stateEpoch: string;

  private started = false;
  private stopped = false;
  private controllerIdentity: string | null = null;
  private userMuted = false;
  private desiredListening: 'open' | 'closed' = 'closed';
  private closedBlocker = 'controller_disconnected';
  private stateSequence = 0;
  private operationVersion = 0;
  private appliedOpenVersion: number | null = null;
  private operationAbortController = new AbortController();
  private nextLeaseId = 1;
  private lease: OpenLease | null = null;
  private activePolicyEpoch: string | null = null;
  private readonly retiredPolicyEpochs = new Set<string>();
  private readonly retiredPolicyEpochOrder: string[] = [];
  private lastOrderedCommand: MediaControlCommand | null = null;
  private lastCommand: CommandResult | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor(options: MediaGateExecutorOptions) {
    requireNonempty(options.targetIdentity, 'targetIdentity');
    if (!Number.isSafeInteger(options.maxOpenLeaseMs) || options.maxOpenLeaseMs <= 0) {
      throw new Error('maxOpenLeaseMs must be a positive safe integer');
    }
    const stateEpoch = options.uuid();
    requireNonempty(stateEpoch, 'state epoch');

    this.targetIdentity = options.targetIdentity;
    this.device = options.device;
    this.publishStateSink = options.publishState;
    this.nowUnixMs = options.nowUnixMs;
    this.nowMonotonicMs = options.nowMonotonicMs;
    this.scheduler = options.scheduler;
    this.maxOpenLeaseMs = options.maxOpenLeaseMs;
    this.stateEpoch = stateEpoch;
  }

  start(): Promise<void> {
    if (this.stopped) throw new Error('media gate executor cannot restart after stop');
    if (this.started) return this.drain();
    this.started = true;
    this.invalidateAndClose('controller_disconnected', true);
    return Promise.resolve();
  }

  bindController(controllerIdentity: string): Promise<void> {
    this.requireStarted();
    requireNonempty(controllerIdentity, 'controller identity');
    if (this.controllerIdentity && this.controllerIdentity !== controllerIdentity) {
      this.invalidateAndClose('controller_conflict', true);
      return Promise.reject(new Error('a different media controller is already bound'));
    }

    this.controllerIdentity = controllerIdentity;
    this.closedBlocker = 'lease_missing';
    this.device.close();
    return this.enqueue(async () => {
      try {
        await this.publishSnapshot(controllerIdentity, null, null);
      } catch (error) {
        if (this.controllerIdentity === controllerIdentity) {
          this.controllerIdentity = null;
          this.resetCommandOrdering();
          this.invalidateAndClose('controller_disconnected', true);
        }
        throw error;
      }
    });
  }

  handleCommand(controllerIdentity: string, command: MediaControlCommand): Promise<void> {
    if (
      !this.started ||
      this.stopped ||
      controllerIdentity !== this.controllerIdentity ||
      command.target_identity !== this.targetIdentity
    ) {
      return Promise.resolve();
    }

    const ordering = this.classifyCommand(command);
    if (ordering === 'duplicate') {
      const result = this.lastCommand;
      if (!result) return Promise.resolve();
      return this.enqueue(() => this.publishCommandResult(controllerIdentity, result));
    }
    if (ordering === 'rejected') {
      const result = {
        command,
        status: 'rejected' as const,
        errorCode: 'command_rejected',
      };
      this.transitionActiveOpenResult('rejected', 'superseded');
      this.invalidateAndClose('command_rejected', true);
      return this.enqueue(async () => {
        await this.publishCommandResult(controllerIdentity, result);
        await this.publishSnapshot(controllerIdentity, null, null);
      });
    }

    this.rememberAcceptedCommand(command);
    if (command.expires_at_unix_ms <= this.nowUnixMs()) {
      const result = { command, status: 'expired' as const, errorCode: null };
      this.lastCommand = result;
      this.invalidateAndClose('lease_expired', true);
      return this.enqueue(() => this.publishCommandResult(controllerIdentity, result));
    }

    if (command.desired_listening === 'closed') {
      const result = { command, status: 'applied' as const, errorCode: null };
      this.lastCommand = result;
      this.invalidateAndClose(command.reason ?? 'automatic_gate_closed', true);
      return this.enqueue(() => this.publishCommandResult(controllerIdentity, result));
    }

    return this.acceptOpen(controllerIdentity, command);
  }

  setUserMuted(userMuted: boolean): Promise<void> {
    this.requireStarted();
    if (this.stopped || this.userMuted === userMuted) return this.drain();

    this.userMuted = userMuted;
    this.advanceOperation();
    if (userMuted) {
      this.transitionActiveOpenResult('rejected', 'user_muted');
      this.device.close();
      return this.publishCurrentWhenBound();
    }

    if (!this.hasFreshOpenLease()) {
      this.device.close();
      return this.publishCurrentWhenBound();
    }
    const controllerIdentity = this.controllerIdentity;
    if (!controllerIdentity) return Promise.resolve();
    const result = this.activeOpenResult();
    const operationVersion = this.operationVersion;
    return this.enqueue(() =>
      this.applyOpen(controllerIdentity, operationVersion, result, false, false)
    );
  }

  disconnectController(controllerIdentity: string): Promise<void> {
    if (controllerIdentity !== this.controllerIdentity) return this.drain();
    this.controllerIdentity = null;
    this.resetCommandOrdering();
    this.invalidateAndClose('controller_disconnected', true);
    return this.drain();
  }

  handleMalformedControl(controllerIdentity: string, errorCode: string): Promise<void> {
    if (controllerIdentity !== this.controllerIdentity || this.stopped) {
      return Promise.resolve();
    }
    requireNonempty(errorCode, 'error code');
    this.transitionActiveOpenResult('rejected', 'superseded');
    this.invalidateAndClose('malformed_control', true);
    return this.enqueue(() => this.publishSnapshot(controllerIdentity, null, errorCode));
  }

  reconcileDevice(): Promise<void> {
    this.requireStarted();
    if (this.stopped) return this.drain();

    this.advanceOperation();
    this.device.close();
    const controllerIdentity = this.controllerIdentity;
    if (!controllerIdentity) return this.drain();
    const result = this.activeOpenResult();
    if (!this.userMuted && this.hasFreshOpenLease() && result) {
      const operationVersion = this.operationVersion;
      return this.enqueue(() =>
        this.applyOpen(controllerIdentity, operationVersion, result, false, false)
      );
    }
    return this.enqueue(() => this.publishSnapshot(controllerIdentity, null, null));
  }

  stop(): Promise<void> {
    if (this.stopped) return this.drain();
    this.stopped = true;
    this.started = false;
    this.controllerIdentity = null;
    this.invalidateAndClose('stopped', true);
    return this.drain();
  }

  drain(): Promise<void> {
    return this.tail;
  }

  private acceptOpen(controllerIdentity: string, command: MediaControlCommand): Promise<void> {
    this.clearLease();
    this.advanceOperation();
    this.desiredListening = 'open';
    this.closedBlocker = 'lease_missing';
    const result: CommandResult = {
      command,
      status: this.userMuted ? 'rejected' : null,
      errorCode: this.userMuted ? 'user_muted' : null,
    };
    this.lastCommand = result;
    const operationVersion = this.operationVersion;
    const remainingWallMs = command.expires_at_unix_ms - this.nowUnixMs();
    const durationMs = Math.min(remainingWallMs, this.maxOpenLeaseMs);
    const lease: OpenLease = {
      id: this.nextLeaseId,
      deadlineMonotonicMs: this.nowMonotonicMs() + durationMs,
      command,
      timer: 0,
    };
    this.nextLeaseId += 1;
    lease.timer = this.scheduler.setTimeout(() => this.expireLease(lease.id), durationMs);
    this.lease = lease;

    if (this.userMuted) {
      this.device.close();
      return this.enqueue(() => this.publishCommandResult(controllerIdentity, result));
    }
    return this.enqueue(() =>
      this.applyOpen(controllerIdentity, operationVersion, result, true, true)
    );
  }

  private async applyOpen(
    controllerIdentity: string,
    operationVersion: number,
    result: CommandResult | null,
    correlateResult: boolean,
    throwDeviceError: boolean
  ): Promise<void> {
    if (!this.canOpen(controllerIdentity, operationVersion)) {
      this.device.close();
      await this.publishInvalidatedOpen(controllerIdentity, result, correlateResult);
      return;
    }
    const signal = this.operationAbortController.signal;
    try {
      await this.openDevice(signal, operationVersion);
    } catch (error) {
      const operationAborted = signal.aborted || isOperationAborted(error);
      if (!operationAborted && this.isOperationCurrent(controllerIdentity, operationVersion)) {
        this.invalidateAndClose('device_apply_failed', true);
        await this.publishOpenFailure(
          controllerIdentity,
          result,
          'device_apply_failed',
          correlateResult
        );
      } else {
        this.device.close();
        await this.publishInvalidatedOpen(controllerIdentity, result, correlateResult);
      }
      if (throwDeviceError && !operationAborted) throw error;
      return;
    }

    if (!this.canOpen(controllerIdentity, operationVersion)) {
      this.device.close();
      await this.publishInvalidatedOpen(controllerIdentity, result, correlateResult);
      return;
    }
    let actual: MediaGateDeviceState;
    try {
      actual = this.device.snapshot();
    } catch (error) {
      this.invalidateAndClose('device_state_unavailable', true);
      if (result) {
        result.status = 'rejected';
        result.errorCode = 'device_state_unavailable';
      }
      throw error;
    }
    if (!actual.captureActive || !actual.trackPublished || actual.trackMuted) {
      this.invalidateAndClose('device_not_ready', true);
      await this.publishOpenFailure(
        controllerIdentity,
        result,
        'device_not_ready',
        correlateResult
      );
      return;
    }
    this.appliedOpenVersion = operationVersion;
    if (result) {
      result.status = 'applied';
      result.errorCode = null;
    }
    if (result && correlateResult) {
      try {
        await this.publishCommandResult(controllerIdentity, result);
      } catch (error) {
        if (isOperationAborted(error)) {
          await this.publishInvalidatedOpen(controllerIdentity, result, true);
          return;
        }
        result.status = 'rejected';
        result.errorCode = 'state_publish_failed';
        throw error;
      }
    } else {
      try {
        await this.publishSnapshot(controllerIdentity, null, null);
      } catch (error) {
        if (isOperationAborted(error)) {
          await this.publishInvalidatedOpen(controllerIdentity, result, false);
          return;
        }
        if (result) {
          result.status = 'rejected';
          result.errorCode = 'state_publish_failed';
        }
        throw error;
      }
    }
  }

  private async openDevice(signal: AbortSignal, operationVersion: number): Promise<void> {
    const openPromise = Promise.resolve().then(async () => {
      if (signal.aborted) throw new OperationAbortedError();
      await this.device.open(signal);
    });
    void openPromise.then(
      () => {
        if (signal.aborted && !this.hasNewerAppliedOpen(operationVersion)) {
          this.device.close();
        }
      },
      () => undefined
    );
    await raceWithAbort(openPromise, signal);
  }

  private expireLease(leaseId: number): void {
    const lease = this.lease;
    if (!lease || lease.id !== leaseId) return;
    this.transitionActiveOpenResult('expired', 'lease_expired');
    this.lease = null;
    this.desiredListening = 'closed';
    this.closedBlocker = 'lease_expired';
    this.advanceOperation();
    this.device.close();
    const controllerIdentity = this.controllerIdentity;
    if (controllerIdentity) {
      void this.enqueue(() => this.publishSnapshot(controllerIdentity, null, null));
    }
  }

  private classifyCommand(command: MediaControlCommand): 'accepted' | 'duplicate' | 'rejected' {
    if (this.retiredPolicyEpochs.has(command.policy_epoch)) return 'rejected';
    if (this.activePolicyEpoch === null) return 'accepted';
    if (this.activePolicyEpoch !== command.policy_epoch) return 'accepted';
    if (!this.lastOrderedCommand) return 'accepted';
    if (command.sequence > this.lastOrderedCommand.sequence) return 'accepted';
    if (
      command.sequence === this.lastOrderedCommand.sequence &&
      commandsEqual(command, this.lastOrderedCommand)
    ) {
      return 'duplicate';
    }
    return 'rejected';
  }

  private rememberAcceptedCommand(command: MediaControlCommand): void {
    if (this.activePolicyEpoch && this.activePolicyEpoch !== command.policy_epoch) {
      this.retirePolicyEpoch(this.activePolicyEpoch);
      this.lastCommand = null;
      this.lastOrderedCommand = null;
    }
    this.activePolicyEpoch = command.policy_epoch;
    this.lastOrderedCommand = command;
  }

  private resetCommandOrdering(): void {
    this.activePolicyEpoch = null;
    this.retiredPolicyEpochs.clear();
    this.retiredPolicyEpochOrder.length = 0;
    this.lastOrderedCommand = null;
    this.lastCommand = null;
  }

  private retirePolicyEpoch(policyEpoch: string): void {
    if (this.retiredPolicyEpochOrder.length === MAX_RETIRED_POLICY_EPOCHS) {
      const expired = this.retiredPolicyEpochOrder.shift();
      if (expired) this.retiredPolicyEpochs.delete(expired);
    }
    this.retiredPolicyEpochOrder.push(policyEpoch);
    this.retiredPolicyEpochs.add(policyEpoch);
  }

  private hasFreshOpenLease(): boolean {
    const lease = this.lease;
    if (!lease || this.desiredListening !== 'open') return false;
    if (this.nowMonotonicMs() < lease.deadlineMonotonicMs) return true;
    this.expireLease(lease.id);
    return false;
  }

  private canOpen(controllerIdentity: string, operationVersion: number): boolean {
    return (
      this.isOperationCurrent(controllerIdentity, operationVersion) &&
      !this.userMuted &&
      this.hasFreshOpenLease()
    );
  }

  private isOperationCurrent(controllerIdentity: string, operationVersion: number): boolean {
    return (
      this.started &&
      !this.stopped &&
      this.controllerIdentity === controllerIdentity &&
      this.operationVersion === operationVersion
    );
  }

  private invalidateAndClose(blocker: string, clearLease: boolean): void {
    this.advanceOperation();
    this.desiredListening = 'closed';
    this.closedBlocker = blocker;
    if (clearLease) this.clearLease();
    this.device.close();
  }

  private advanceOperation(): void {
    this.appliedOpenVersion = null;
    this.operationAbortController.abort();
    this.operationAbortController = new AbortController();
    this.operationVersion += 1;
  }

  private hasNewerAppliedOpen(abortedOperationVersion: number): boolean {
    if (
      this.operationVersion === abortedOperationVersion ||
      this.appliedOpenVersion !== this.operationVersion ||
      !this.started ||
      this.stopped ||
      !this.controllerIdentity ||
      this.userMuted ||
      this.desiredListening !== 'open'
    ) {
      return false;
    }
    const lease = this.lease;
    if (!lease) return false;
    try {
      return this.nowMonotonicMs() < lease.deadlineMonotonicMs;
    } catch {
      return false;
    }
  }

  private clearLease(): void {
    if (!this.lease) return;
    this.scheduler.clearTimeout(this.lease.timer);
    this.lease = null;
  }

  private publishCurrentWhenBound(): Promise<void> {
    const controllerIdentity = this.controllerIdentity;
    if (!controllerIdentity) return this.drain();
    return this.enqueue(() => this.publishSnapshot(controllerIdentity, null, null));
  }

  private publishCommandResult(controllerIdentity: string, result: CommandResult): Promise<void> {
    if (result.status === null) {
      throw new Error('media command result is not settled');
    }
    return this.publishSnapshot(controllerIdentity, result, result.errorCode);
  }

  private publishInvalidatedOpen(
    controllerIdentity: string,
    result: CommandResult | null,
    correlateResult: boolean
  ): Promise<void> {
    const { status, errorCode } = this.openInvalidationResult();
    return this.publishOpenFailure(controllerIdentity, result, errorCode, correlateResult, status);
  }

  private publishOpenFailure(
    controllerIdentity: string,
    result: CommandResult | null,
    errorCode: string,
    correlateResult: boolean,
    status: CommandStatus = 'rejected'
  ): Promise<void> {
    if (this.controllerIdentity !== controllerIdentity || this.stopped) {
      if (result) {
        result.status = status;
        result.errorCode = errorCode;
      }
      return Promise.resolve();
    }
    if (result) {
      result.status = status;
      result.errorCode = errorCode;
    }
    if (result && correlateResult) {
      return this.publishCommandResult(controllerIdentity, result);
    }
    return this.publishSnapshot(controllerIdentity, null, errorCode);
  }

  private activeOpenResult(): CommandResult | null {
    const lease = this.lease;
    const result = this.lastCommand;
    if (!lease || !result || !commandsEqual(lease.command, result.command)) {
      return null;
    }
    return result;
  }

  private transitionActiveOpenResult(status: CommandStatus, errorCode: string): void {
    const result = this.activeOpenResult();
    if (!result) return;
    result.status = status;
    result.errorCode = errorCode;
  }

  private openInvalidationResult(): {
    status: CommandStatus;
    errorCode: string;
  } {
    if (this.userMuted) return { status: 'rejected', errorCode: 'user_muted' };
    if (this.closedBlocker === 'lease_expired') {
      return { status: 'expired', errorCode: 'lease_expired' };
    }
    return { status: 'rejected', errorCode: 'superseded' };
  }

  private async publishSnapshot(
    controllerIdentity: string,
    result: CommandResult | null,
    errorCode: string | null
  ): Promise<void> {
    if (this.controllerIdentity !== controllerIdentity || this.stopped) return;
    const signal = this.operationAbortController.signal;
    try {
      const actual = this.device.snapshot();
      const correlation = result
        ? {
            command_id: result.command.command_id,
            policy_epoch: result.command.policy_epoch,
            command_sequence: result.command.sequence,
            command_status: result.status,
          }
        : NULL_CORRELATION;
      const state: MediaStateSnapshot = {
        schema_version: 1,
        type: MEDIA_STATE_TOPIC,
        target_identity: this.targetIdentity,
        state_epoch: this.stateEpoch,
        state_sequence: this.nextStateSequence(),
        observed_at_unix_ms: this.safeNowUnixMs(),
        capture_active: actual.captureActive,
        track_published: actual.trackPublished,
        track_muted: actual.trackMuted,
        user_muted: this.userMuted,
        blocked_by: this.blockedBy(actual),
        ...correlation,
        error_code: errorCode,
      };
      const publishPromise = Promise.resolve().then(() => {
        if (signal.aborted) throw new OperationAbortedError();
        return this.publishStateSink(controllerIdentity, state, signal);
      });
      await raceWithAbort(publishPromise, signal);
    } catch (error) {
      if (signal.aborted || isOperationAborted(error)) {
        throw new OperationAbortedError();
      }
      this.invalidateAndClose('state_publish_failed', true);
      throw error;
    }
  }

  private blockedBy(actual: MediaGateDeviceState): readonly string[] {
    const blockers: string[] = [];
    if (this.userMuted) blockers.push('user_muted');
    if (!this.started || this.stopped) blockers.push('stopped');
    if (!this.controllerIdentity) blockers.push('controller_disconnected');
    if (this.desiredListening !== 'open') blockers.push(this.closedBlocker);
    if (!actual.captureActive) blockers.push('capture_inactive');
    if (!actual.trackPublished) blockers.push('track_unpublished');
    return [...new Set(blockers)];
  }

  private nextStateSequence(): number {
    if (this.stateSequence >= Number.MAX_SAFE_INTEGER) {
      throw new Error('media state sequence exhausted');
    }
    this.stateSequence += 1;
    return this.stateSequence;
  }

  private safeNowUnixMs(): number {
    const value = this.nowUnixMs();
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('wall clock must return a non-negative safe integer');
    }
    return value;
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const next = this.tail.catch(() => undefined).then(action);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private requireStarted(): void {
    if (!this.started || this.stopped) throw new Error('media gate executor is not running');
  }
}

function commandsEqual(left: MediaControlCommand, right: MediaControlCommand): boolean {
  return (
    left.command_id === right.command_id &&
    left.policy_epoch === right.policy_epoch &&
    left.sequence === right.sequence &&
    left.target_identity === right.target_identity &&
    left.desired_listening === right.desired_listening &&
    left.issued_at_unix_ms === right.issued_at_unix_ms &&
    left.expires_at_unix_ms === right.expires_at_unix_ms &&
    left.reason === right.reason
  );
}

function requireNonempty(value: string, label: string): void {
  if (!value) throw new Error(`${label} must be non-empty`);
}

class OperationAbortedError extends Error {
  constructor() {
    super('media gate operation aborted');
    this.name = 'AbortError';
  }
}

function isOperationAborted(error: unknown): boolean {
  return error instanceof OperationAbortedError;
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new OperationAbortedError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new OperationAbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}
