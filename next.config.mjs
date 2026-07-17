// @ts-check
import withAvatarkit from '@spatius/avatarkit/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

// `withAvatarkit` wires up serving of the Spatius avatar WASM decoder (for both
// Turbopack and Webpack) and copies it into `public/_avatarkit/`. It only touches
// the `avatar_core_wasm*` assets, so it is effectively a no-op for the standard
// (non-avatar) path.
//
// NOTE: this config is `.mjs` (native ESM) on purpose — `@spatius/avatarkit/next`
// is published as an ESM-only subpath export, which Next.js can only resolve when
// the config itself is loaded as ESM.
export default withAvatarkit(nextConfig);
