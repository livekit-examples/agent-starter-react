# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Next.js + Turbopack) at localhost:3000
pnpm build            # Production build
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier
pnpm format:check     # Check formatting without changes
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` - Required for token generation
- `AGENT_NAME` - Optional, leave blank for automatic agent dispatch

## Architecture

This is a Next.js 15 + React 19 voice agent frontend for LiveKit. The app connects users to AI voice agents via real-time audio/video.

### Core Data Flow

1. **App** (`components/app/app.tsx`) wraps everything in LiveKit's `SessionProvider`
2. **ViewController** switches between `WelcomeView` (pre-call) and `SessionView` (active call)
3. On "Start call", the app fetches a token from `/api/connection-details` and joins a LiveKit room
4. **SessionView** displays the agent video/audio tiles, chat transcript, and control bar

### Key Directories

- `app/api/connection-details/` - Token generation endpoint (creates room, participant identity, JWT)
- `components/app/` - Main views: `welcome-view.tsx`, `session-view.tsx`, `tile-layout.tsx`, `chat-transcript.tsx`
- `components/livekit/agent-control-bar/` - Microphone/camera/screen share toggles, chat input, device selection
- `components/livekit/agent-control-bar/hooks/` - `useInputControls` (device state), `usePublishPermissions` (permission checks)
- `hooks/` - `useAgentErrors` (failure handling), `useDebugMode` (dev logging)
- `lib/utils.ts` - Config fetching (`getAppConfig`), styling utilities, sandbox token helpers
- `app-config.ts` - Feature flags and branding configuration

### Configuration

`app-config.ts` defines `AppConfig` with:
- UI branding: `logo`, `accent`, `pageTitle`, `companyName`
- Feature flags: `supportsChatInput`, `supportsVideoInput`, `supportsScreenShare`
- Agent dispatch: `agentName` for explicit dispatch

Config can be fetched remotely via `NEXT_PUBLIC_APP_CONFIG_ENDPOINT` (for sandbox deployments) or uses defaults.

### Tech Stack

- **LiveKit**: `@livekit/components-react`, `livekit-client`, `livekit-server-sdk`
- **Animation**: `motion` (Framer Motion)
- **UI**: Tailwind CSS v4, Radix UI primitives, Phosphor Icons
- **Notifications**: `sonner` toasts
- **Theming**: `next-themes` for dark mode
