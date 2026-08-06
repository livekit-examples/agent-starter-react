export type RuntimeSlot<Runtime> = {
  current: Runtime | null;
};

export type RuntimeStartStage = <Value>(
  operation: () => Value | PromiseLike<Value>
) => Promise<Value>;

export type AudioBindingRuntime = {
  readonly audioEnabled: boolean;
  readonly audioPublishPromise: Promise<void> | null;
};

export type AudioBindingReplacement = {
  close(): void;
  unpublish(): Promise<void>;
  reconcile(): Promise<void>;
  ensurePublished(): Promise<void>;
  hasBinding(): boolean;
};

export class RuntimeStartCancelledError extends Error {
  override readonly name = 'AbortError';

  constructor(cause?: unknown) {
    super('browser source runtime start was superseded');
    this.cause = cause;
  }
}

export function isCurrentRuntime<Runtime>(slot: RuntimeSlot<Runtime>, runtime: Runtime): boolean {
  return slot.current === runtime;
}

export function detachCurrentRuntime<Runtime>(slot: RuntimeSlot<Runtime>): Runtime | null {
  const runtime = slot.current;
  slot.current = null;
  return runtime;
}

export async function stopOwnedRuntime<Runtime>(
  slot: RuntimeSlot<Runtime>,
  runtime: Runtime,
  stopRuntime: (runtime: Runtime) => Promise<void>
): Promise<void> {
  if (slot.current === runtime) {
    slot.current = null;
  }
  await stopRuntime(runtime);
}

export async function runOwnedRuntimeStart<Runtime>(
  slot: RuntimeSlot<Runtime>,
  runtime: Runtime,
  stopRuntime: (runtime: Runtime) => Promise<void>,
  startRuntime: (stage: RuntimeStartStage) => Promise<void>
): Promise<void> {
  const assertOwned = () => {
    if (!isCurrentRuntime(slot, runtime)) {
      throw new RuntimeStartCancelledError();
    }
  };
  const stage: RuntimeStartStage = async (operation) => {
    assertOwned();
    try {
      const value = await operation();
      assertOwned();
      return value;
    } catch (error) {
      if (!isCurrentRuntime(slot, runtime)) {
        throw new RuntimeStartCancelledError(error);
      }
      throw error;
    }
  };

  try {
    assertOwned();
    await startRuntime(stage);
    assertOwned();
  } catch (error) {
    try {
      await stopOwnedRuntime(slot, runtime, stopRuntime);
    } catch (stopError) {
      if (isAbortError(error)) throw error;
      throw stopError;
    }
    throw error;
  }
}

export async function replaceRuntimeAudioBinding(
  runtime: AudioBindingRuntime,
  replacement: AudioBindingReplacement
): Promise<void> {
  replacement.close();
  await runtime.audioPublishPromise?.catch(() => undefined);
  await replacement.unpublish();
  if (!runtime.audioEnabled) return;

  await replacement.reconcile();
  if (replacement.hasBinding()) return;

  await replacement.ensurePublished();
  await replacement.reconcile();
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof RuntimeStartCancelledError ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
  );
}
