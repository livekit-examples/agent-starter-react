/** A Future represents a serialized version of a new Promise(...) call, exposing the promise plus
  * corresponding resolve and reject functions to be used as an async execution management building
  * block.
  *
  * @example
  * ```ts
  * const future = new Future();
  *
  * async function startA() {
  *   setTimeout(() => future.resolve(123), 5000);
  * }
  * 
  * async function waitForA() {
  *   await future.promise;
  * }
  *
  * async function main() {
  *   startA();
  *   const result = await waitForA();
  *   console.log(result); // logs 123
  * }
  * ```
  * */
export default class Future<T> {
  promise: Promise<T>;

  // NOTE: these `throw`s shouldn't ever happen in practice, `new Promise` runs its callback
  // syncronusly.
  resolve: (arg: T) => void = () => { throw new Error('Future not yet initialized!') };
  reject: (e: any) => void = () => { throw new Error('Future not yet initialized!') };

  onFinally?: () => void;

  get isResolved(): boolean {
    return this._isResolved;
  }

  private _isResolved: boolean = false;

  constructor(
    futureBase?: (resolve: (arg: T) => void, reject: (e: any) => void) => void | Promise<void>,
    onFinally?: () => void,
  ) {
    this.onFinally = onFinally;
    this.promise = new Promise<T>(async (resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      if (futureBase) {
        const futureBaseReturn = futureBase(resolve, reject);
        if (futureBaseReturn instanceof Promise) {
          await futureBaseReturn;
        }
      }
    }).finally(() => {
      this._isResolved = true;
      this.onFinally?.();
    });
  }
}
