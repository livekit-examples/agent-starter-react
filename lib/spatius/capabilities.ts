export interface SpatiusSupport {
  supported: boolean;
  /** Human-readable reason shown to the user when unsupported. */
  reason?: string;
}

/**
 * Feature-detect whether this browser can run the Spatius avatar decoder.
 *
 * The decoder needs two things the standard video path does not:
 * - `RTCRtpScriptTransform` (WebRTC Encoded Transform) to intercept the
 *   fake-VP8 motion frames. Firefox lacks this.
 * - WebGPU or WebGL2 to render the 3D gaussian-splat avatar.
 *
 * Client-only — returns `{ supported: false }` during SSR.
 */
export function detectSpatiusSupport(): SpatiusSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'ssr' };
  }

  const hasEncodedTransform =
    typeof (window as unknown as { RTCRtpScriptTransform?: unknown }).RTCRtpScriptTransform !==
    'undefined';

  if (!hasEncodedTransform) {
    return {
      supported: false,
      reason:
        'This browser cannot decode the avatar motion stream (no WebRTC Encoded Transform). Try Chrome, Edge, or Safari.',
    };
  }

  const hasWebGPU = 'gpu' in navigator;
  let hasWebGL2 = false;
  try {
    hasWebGL2 = !!document.createElement('canvas').getContext('webgl2');
  } catch {
    hasWebGL2 = false;
  }

  if (!hasWebGPU && !hasWebGL2) {
    return {
      supported: false,
      reason: 'This browser cannot render the avatar (no WebGPU or WebGL2 support).',
    };
  }

  return { supported: true };
}
