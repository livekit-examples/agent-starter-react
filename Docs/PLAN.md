# LiveKit Learning Plan

A hands-on guide to understanding LiveKit by building a simple video room application.

---

## 1. Overview

**Goal**: Build a minimal, properly-structured app to understand LiveKit fundamentals, then see how AI voice agents fit in.

**Approach**: Create a separate `livekit-learning/` folder with a clean Next.js app that demonstrates core concepts step by step.

**What You'll Learn**:
- Rooms, Participants, and Tracks
- Token-based authentication
- Publishing and subscribing to audio/video
- Event-driven architecture
- How AI agents integrate as participants

---

## 2. Setup & Account Creation

### 2.1 Create LiveKit Cloud Account (Free)

1. Go to https://cloud.livekit.io
2. Sign up for a free account (no credit card required)
3. Create a new project
4. From the project dashboard, copy:
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `LIVEKIT_URL` (e.g., `wss://your-project.livekit.cloud`)

### 2.2 Environment Setup

Create `.env.local` in the `livekit-learning/` folder:

```bash
cp .env.example .env.local
# Then fill in your credentials
```

---

## 3. Core Concepts

### 3.1 Rooms

A **Room** is a virtual space where participants meet. Think of it like a video call room.

- Each room has a unique name
- Participants join by connecting to that room
- Rooms are created automatically when the first participant joins

### 3.2 Participants

Anyone connected to a room is a **Participant**. There are two types:

| Type | Description | Example |
|------|-------------|---------|
| **Local Participant** | You | Your browser session |
| **Remote Participant** | Everyone else | Other users, AI agents |

### 3.3 Tracks

**Tracks** are audio or video streams.

- **Publishing**: When you turn on your camera, you "publish" a video track
- **Subscribing**: When someone else has their camera on, you "subscribe" to their track
- Track types: `Audio`, `Video`, `Data` (for messages)

### 3.4 Tokens

**Tokens** are JWTs that authenticate participants.

They contain:
- **Identity**: Who you are (unique per participant)
- **Room**: Which room you can join
- **Permissions**: What you can do (publish video? audio? subscribe?)

Tokens are signed with your API secret, so only your server can create valid tokens.

### 3.5 Events

LiveKit uses **events** to notify you when things happen:

| Event | When it fires |
|-------|---------------|
| `ConnectionStateChanged` | Connection status changes |
| `ParticipantConnected` | Someone joins the room |
| `ParticipantDisconnected` | Someone leaves the room |
| `TrackSubscribed` | You receive someone's track |
| `TrackUnsubscribed` | A track is removed |

---

## 4. Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      LiveKit Cloud                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     ROOM                            │    │
│  │                                                     │    │
│  │   ┌──────────┐    Tracks    ┌──────────┐           │    │
│  │   │  You     │ ──────────▶  │  Others  │           │    │
│  │   │ (Local)  │ ◀──────────  │ (Remote) │           │    │
│  │   └──────────┘              └──────────┘           │    │
│  │        │                          │                │    │
│  │        └──────────────────────────┘                │    │
│  │                    │                               │    │
│  └────────────────────┼───────────────────────────────┘    │
│                       │ WebSocket                          │
└───────────────────────┼─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼───────┐               ┌───────▼───────┐
│  Your Browser │               │  AI Agent     │
│  (livekit-    │               │  (Python/     │
│   client)     │               │   Node.js)    │
└───────────────┘               └───────────────┘
```

### 4.2 Token Flow

```
Browser                    Your Server                LiveKit Cloud
   │                            │                           │
   │  1. Request token          │                           │
   │ ─────────────────────────▶ │                           │
   │                            │                           │
   │  2. Generate JWT with      │                           │
   │     identity + room +      │                           │
   │     permissions            │                           │
   │ ◀───────────────────────── │                           │
   │                            │                           │
   │  3. Connect with token     │                           │
   │ ──────────────────────────────────────────────────────▶│
   │                            │                           │
   │  4. Validate token,        │                           │
   │     join room              │                           │
   │ ◀──────────────────────────────────────────────────────│
```

---

## 5. Project Structure

```
livekit-learning/
├── app/
│   ├── api/
│   │   └── token/route.ts      # Token generation endpoint
│   ├── room/
│   │   └── page.tsx            # Room page (client component)
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page with concept explanations
│   └── globals.css             # Styles
├── components/
│   ├── VideoTile.tsx           # Display a video track
│   └── ConnectionStatus.tsx    # Show connection state
├── .env.local                  # Your credentials (not committed)
├── .env.example                # Template for credentials
└── package.json                # Dependencies
```

---

## 6. Implementation Details

### 6.1 Token Generation (`app/api/token/route.ts`)

```typescript
const token = new AccessToken(apiKey, apiSecret, {
  identity: userName,  // Who this person is
  ttl: '1h',           // Token expires in 1 hour
});

token.addGrant({
  room: roomName,      // Which room they can join
  roomJoin: true,      // Can join the room
  canPublish: true,    // Can publish audio/video
  canSubscribe: true,  // Can receive others' audio/video
});
```

### 6.2 Room Connection (`app/room/page.tsx`)

```typescript
// 1. Create room instance
const room = new Room();

// 2. Set up event listeners
room.on(RoomEvent.ParticipantConnected, (participant) => {
  console.log('Someone joined:', participant.identity);
});

// 3. Connect with token
await room.connect(url, token);

// 4. Enable camera
await room.localParticipant.setCameraEnabled(true);
```

### 6.3 Displaying Video

```typescript
// Attach a video track to a <video> element
const videoElement = document.getElementById('video');
videoTrack.attach(videoElement);
```

---

## 7. Agent Integration

### 7.1 How Agents Work

AI agents are simply **participants that connect to the room** programmatically. Instead of a human controlling them, code controls them.

The agent:
1. Connects to the same room as users
2. Subscribes to users' audio tracks
3. Processes audio through AI pipeline
4. Publishes audio/video responses back

### 7.2 Agent Flow

```
User speaks
    ↓
Audio track published to room
    ↓
Agent subscribes to your audio
    ↓
Speech-to-Text (STT)
    ↓
Large Language Model (LLM)
    ↓
Text-to-Speech (TTS)
    ↓
Agent publishes audio track
    ↓
You hear the response
```

### 7.3 Agent Dispatch

When a user joins a room, an agent can be automatically dispatched to join the same room. This is handled by:

1. **Explicit dispatch**: Your server tells LiveKit to start an agent for a specific room
2. **Automatic dispatch**: Configure LiveKit to auto-dispatch agents when rooms are created

The `douala` app in this repo demonstrates agent dispatch via the `AGENT_NAME` environment variable.

---

## 8. Verification Plan

| Step | Test | Expected Result |
|------|------|-----------------|
| 1 | Visit `/api/token?room=test&user=alice` | JSON with `token` and `url` |
| 2 | Open `/room?name=test` | "Connected" status |
| 3 | Click "Enable Camera" | See your video |
| 4 | Open same room in 2 tabs | See each other's video |
| 5 | Check event log | See connection/track events |

---

## 9. Files Created

| File | Purpose | Status |
|------|---------|--------|
| `livekit-learning/package.json` | Dependencies | ✅ Created |
| `livekit-learning/app/layout.tsx` | Root layout | ✅ Created |
| `livekit-learning/app/globals.css` | Styles | ❌ Not created |
| `livekit-learning/app/page.tsx` | Home with explanations | ✅ Created |
| `livekit-learning/app/api/token/route.ts` | Token generation | ✅ Created |
| `livekit-learning/app/room/page.tsx` | Room interface | ✅ Created |
| `livekit-learning/components/VideoTile.tsx` | Video display | ❌ Not created |
| `livekit-learning/components/ConnectionStatus.tsx` | Connection indicator | ❌ Not created |
| `livekit-learning/.env.example` | Credential template | ✅ Created |
| `livekit-learning/tsconfig.json` | TypeScript config | ❌ Not created |
| `livekit-learning/next.config.ts` | Next.js config | ❌ Not created |

---

## 10. Step-by-Step Learning Journey

Work through these steps in order. After each step, take time to understand what was done and why before moving on.

---

### Phase A: Project Setup

#### Step 1: Create project structure with package.json
- [x] **Status**: ✅ Completed
- **What we're doing**: Setting up a new Next.js project with LiveKit dependencies
- **Files**: `livekit-learning/package.json`
- **What you'll learn**:
  - The two main LiveKit packages: `livekit-client` (browser) and `livekit-server-sdk` (server)
  - Why we need both: client connects to rooms, server generates tokens
- **Review after completing**:
  - Open `package.json` and look at the dependencies
  - Notice `livekit-client` vs `livekit-server-sdk` - what's the difference?

#### Step 2: Create TypeScript and Next.js config files
- [ ] **Status**: Not started
- **What we're doing**: Configuring TypeScript and Next.js for our project
- **Files**: `tsconfig.json`, `next.config.ts`
- **What you'll learn**:
  - Path aliases (`@/` prefix) for cleaner imports
  - Next.js configuration basics
- **Review after completing**:
  - Look at the `paths` in `tsconfig.json` - how does `@/components` work?

#### Step 3: Create layout and global styles
- [ ] **Status**: Not started
- **What we're doing**: Setting up the root layout and CSS
- **Files**: `app/layout.tsx`, `app/globals.css`
- **What you'll learn**:
  - Next.js App Router layout system
  - How layouts wrap all pages
- **Review after completing**:
  - Notice how `layout.tsx` wraps `{children}` - every page gets this wrapper

---

### Phase B: Token Authentication

#### Step 4: Create the token generation endpoint
- [ ] **Status**: Not started
- **What we're doing**: Building an API route that creates JWT tokens for LiveKit
- **Files**: `app/api/token/route.ts`
- **What you'll learn**:
  - **JWT tokens**: How LiveKit authenticates users
  - **AccessToken class**: The main class from `livekit-server-sdk`
  - **Grants**: Permissions embedded in the token (canPublish, canSubscribe, etc.)
  - **Why server-side**: Tokens must be created on the server because they're signed with your secret key
- **Key code to understand**:
  ```typescript
  const token = new AccessToken(apiKey, apiSecret, { identity: userName });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true });
  ```
- **Review after completing**:
  - Read through the comments in the file
  - What happens if you change `canPublish: false`? (User can't share camera/mic)
  - Why do we never cache tokens? (Security - each should be fresh)

#### Step 5: Create .env.local with your LiveKit credentials
- [ ] **Status**: Not started
- **What we're doing**: Adding your personal LiveKit Cloud credentials
- **Files**: `.env.local` (copy from `.env.example`)
- **What you'll learn**:
  - How environment variables protect secrets
  - The three required LiveKit credentials and what each does
- **Action required**:
  1. Go to https://cloud.livekit.io and create a free account
  2. Create a new project
  3. Copy API Key, API Secret, and WebSocket URL
- **Review after completing**:
  - `LIVEKIT_API_KEY`: Identifies your project (like a username)
  - `LIVEKIT_API_SECRET`: Signs tokens (like a password - never expose!)
  - `LIVEKIT_URL`: WebSocket endpoint for real-time communication

#### Step 6: Test the token endpoint
- [ ] **Status**: Not started
- **What we're doing**: Verifying token generation works
- **Test**: Visit `http://localhost:3001/api/token?room=test&user=alice`
- **What you'll learn**:
  - What a LiveKit token looks like (it's a JWT - three base64 parts separated by dots)
  - The debug info shows what's encoded in the token
- **Expected result**: JSON with `token`, `url`, and `_debug` fields
- **Review after completing**:
  - Copy the token and paste it at https://jwt.io - what do you see?
  - The payload shows identity, room, and permissions

---

### Phase C: UI Components

#### Step 7: Create ConnectionStatus component
- [ ] **Status**: Not started
- **What we're doing**: Building a visual indicator for connection state
- **Files**: `components/ConnectionStatus.tsx`
- **What you'll learn**:
  - LiveKit's `ConnectionState` enum: `Disconnected`, `Connecting`, `Connected`, `Reconnecting`
  - How to give users feedback about connection health
- **Review after completing**:
  - What states can a room connection be in?
  - Why is "Reconnecting" important? (Network hiccups shouldn't break the call)

#### Step 8: Create VideoTile component
- [ ] **Status**: Not started
- **What we're doing**: Building a component that displays a video track
- **Files**: `components/VideoTile.tsx`
- **What you'll learn**:
  - **Track attachment**: How LiveKit video tracks connect to HTML `<video>` elements
  - **The attach/detach pattern**: `track.attach(videoElement)` and `track.detach()`
  - **useEffect cleanup**: Why we detach tracks when component unmounts
- **Key code to understand**:
  ```typescript
  useEffect(() => {
    if (track && videoRef.current) {
      track.attach(videoRef.current);  // Connect track to <video>
      return () => { track.detach(); }; // Cleanup on unmount
    }
  }, [track]);
  ```
- **Review after completing**:
  - Why do we use `useRef` for the video element?
  - What happens if we don't call `track.detach()` on cleanup?

---

### Phase D: Room Connection

#### Step 9: Create the home page with concept explanations
- [ ] **Status**: Not started
- **What we're doing**: Building an educational landing page
- **Files**: `app/page.tsx`
- **What you'll learn**:
  - Overview of all LiveKit concepts in one place
  - Architecture diagrams showing how pieces connect
- **Review after completing**:
  - Read through each concept section
  - Make sure you understand Rooms, Participants, Tracks, Tokens, Events

#### Step 10: Create the room page (main interface)
- [ ] **Status**: Not started
- **What we're doing**: Building the core page where LiveKit magic happens
- **Files**: `app/room/page.tsx`
- **What you'll learn**:
  - **Room class**: The main LiveKit object (`new Room()`)
  - **Connecting**: `room.connect(url, token)`
  - **Event listeners**: `room.on(RoomEvent.ParticipantConnected, ...)`
  - **Local participant**: `room.localParticipant` (you)
  - **Remote participants**: `room.remoteParticipants` (others)
  - **Publishing tracks**: `localParticipant.setCameraEnabled(true)`
- **Key code to understand**:
  ```typescript
  // 1. Create room
  const room = new Room();

  // 2. Listen for events BEFORE connecting
  room.on(RoomEvent.ParticipantConnected, (p) => { ... });

  // 3. Connect
  await room.connect(url, token);

  // 4. Publish your camera
  await room.localParticipant.setCameraEnabled(true);
  ```
- **Review after completing**:
  - Why do we set up event listeners BEFORE calling `connect()`?
  - What's the difference between `localParticipant` and `remoteParticipants`?
  - Look at the event log - what events fire when you connect?

---

### Phase E: Testing & Verification

#### Step 11: Install dependencies and start the app
- [ ] **Status**: Not started
- **What we're doing**: Installing packages and running the dev server
- **Commands**:
  ```bash
  cd livekit-learning
  pnpm install
  pnpm dev
  ```
- **What you'll learn**:
  - The app runs on port 3001 (to avoid conflict with main app on 3000)
- **Expected result**: App running at http://localhost:3001

#### Step 12: Test single-user room connection
- [ ] **Status**: Not started
- **What we're doing**: Verifying you can connect to a room and see your own video
- **Test steps**:
  1. Go to http://localhost:3001
  2. Click "Join Test Room"
  3. Click "Connect"
  4. Click "Enable Camera"
- **What you'll learn**:
  - The full flow: token fetch → room connect → publish camera
  - Watch the Event Log to see what happens at each step
- **Review after completing**:
  - What events appeared in the log?
  - Can you see your video in the "You" tile?

#### Step 13: Test multi-participant
- [ ] **Status**: Not started
- **What we're doing**: Verifying two users can see each other
- **Test steps**:
  1. Open http://localhost:3001/room?name=test in Tab 1
  2. Open http://localhost:3001/room?name=test in Tab 2 (same room!)
  3. Connect both tabs
  4. Enable camera in both tabs
- **What you'll learn**:
  - `ParticipantConnected` event fires when the other tab joins
  - `TrackSubscribed` event fires when you receive their video
  - Both tabs see each other because they're in the same room
- **Review after completing**:
  - What events did you see when the second tab connected?
  - How did the first tab know about the second tab's camera?

---

### Phase F: Understanding the Main App

#### Step 14: Review the douala app's agent integration
- [ ] **Status**: Not started
- **What we're doing**: Understanding how the production app integrates AI agents
- **Files to review**:
  - `douala/app/api/connection-details/route.ts` - Token generation with agent dispatch
  - `douala/components/app/app.tsx` - SessionProvider setup
  - `douala/components/app/session-view.tsx` - Active call UI
- **What you'll learn**:
  - How `agentName` parameter triggers agent dispatch
  - How `@livekit/components-react` simplifies LiveKit integration
  - The difference between our learning app (raw SDK) and production app (React components)
- **Review after completing**:
  - Compare our `token/route.ts` with douala's `connection-details/route.ts`
  - What extra features does the production app have?
  - How does the agent know to join the room?

---

## Progress Tracker

| Phase | Steps | Status |
|-------|-------|--------|
| A. Project Setup | 1-3 | 🔄 In progress (1/3) |
| B. Token Authentication | 4-6 | ⬜ Not started |
| C. UI Components | 7-8 | ⬜ Not started |
| D. Room Connection | 9-10 | ⬜ Not started |
| E. Testing | 11-13 | ⬜ Not started |
| F. Main App Review | 14 | ⬜ Not started |

**Legend**: ⬜ Not started | 🔄 In progress | ✅ Completed
