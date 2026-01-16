# Step 1 Answers: Project Structure & Package.json

Detailed explanations for each question.

---

## Answer 1: The Two Packages

### `livekit-client`
- **Runs on**: Browser (client-side)
- **Used for**:
  - Connecting to LiveKit rooms
  - Publishing audio/video tracks (your camera, microphone)
  - Subscribing to other participants' tracks
  - Handling real-time events (someone joined, track published, etc.)

### `livekit-server-sdk`
- **Runs on**: Server (Node.js, in our case Next.js API routes)
- **Used for**:
  - Generating JWT access tokens
  - Managing rooms programmatically (create, delete, list)
  - Managing participants (kick, mute, etc.)
  - Webhook handling

### Why This Matters
```
┌─────────────────────────────────────────────┐
│              Your Application               │
│                                             │
│  Browser (React)      Server (Next.js API)  │
│  ┌─────────────┐      ┌─────────────────┐   │
│  │ livekit-    │      │ livekit-server- │   │
│  │ client      │      │ sdk             │   │
│  │             │      │                 │   │
│  │ - Connect   │      │ - Generate      │   │
│  │ - Publish   │      │   tokens        │   │
│  │ - Subscribe │      │ - Manage rooms  │   │
│  └─────────────┘      └─────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Answer 2: Why Two Packages?

**Short answer**: Security and separation of concerns.

**Detailed explanation**:

1. **Security**: The server SDK needs your `LIVEKIT_API_SECRET` to sign tokens. This secret must NEVER be exposed to browsers. By having a separate server package, you're forced to keep secret operations on the server.

2. **Different environments**: Browsers and servers have different capabilities:
   - Browsers have WebRTC for audio/video
   - Servers have access to environment variables and secure storage

3. **Bundle size**: The client package is optimized for browsers (smaller, no Node.js dependencies). Including server code would bloat the browser bundle.

4. **Different use cases**:
   - Client: Real-time communication (needs WebRTC, media handling)
   - Server: Administrative tasks (tokens, room management)

**Analogy**: Think of it like a hotel:
- The **client SDK** is like the guest - they can enter rooms, use facilities, interact with others
- The **server SDK** is like the hotel management - they issue key cards (tokens), create/delete rooms, control access

---

## Answer 3: Security Risk

### a) What would we expose?
- `LIVEKIT_API_KEY` - Your project identifier
- `LIVEKIT_API_SECRET` - The secret key used to sign tokens

### b) What could a malicious user do?
With the API secret, an attacker could:
1. **Create tokens for any room** - Access rooms they shouldn't be in
2. **Create tokens with any identity** - Impersonate other users
3. **Create tokens with admin permissions** - Grant themselves abilities to kick others, record, etc.
4. **Create unlimited tokens** - Abuse your LiveKit quota
5. **Access your LiveKit dashboard** - Potentially delete rooms, access recordings

### c) Why is this a security problem?
Your API secret is like a master key. Anyone with it has full control over your LiveKit project. Browser code is **always visible** to users (View Source, DevTools). There's no way to hide secrets in client-side code.

**The Rule**: Never put secrets in browser code. Always keep them on the server.

```
❌ WRONG (Browser)                    ✅ CORRECT (Server)
┌─────────────────────┐              ┌─────────────────────┐
│ const token = new   │              │ // API Route        │
│   AccessToken(      │              │ const token = new   │
│     "api_key",      │              │   AccessToken(      │
│     "SECRET123"  ←──┼── Exposed!   │     process.env.KEY,│
│   );                │              │     process.env.SEC │
└─────────────────────┘              │   );           ↑    │
                                     └───────────────┼────┘
                                              Hidden on server
```

---

## Answer 4: The Token Flow

**Correct order**:

1. **Browser requests a token from the server**
   - Browser calls `/api/token?room=myroom&user=alice`

2. **Server creates a signed JWT token using the API secret**
   - Server uses `AccessToken` class with the secret
   - Token contains: identity, room name, permissions, expiry

3. **Browser connects to LiveKit Cloud using the token**
   - Browser calls `room.connect(url, token)`
   - LiveKit Cloud validates the token signature
   - If valid, user joins the room

```
Browser                    Server                     LiveKit Cloud
   │                          │                            │
   │ 1. GET /api/token        │                            │
   │ ────────────────────────▶│                            │
   │                          │                            │
   │ 2. Return JWT token      │                            │
   │ ◀────────────────────────│                            │
   │                          │                            │
   │ 3. Connect with token    │                            │
   │ ─────────────────────────────────────────────────────▶│
   │                          │                            │
   │ 4. Validate & join       │                            │
   │ ◀─────────────────────────────────────────────────────│
```

---

## Answer 5: Port Number

### a) What port?
**Port 3001**

### b) Why not 3000?
The main application (`douala`) runs on port 3000 (the default Next.js port). If we also used 3000, we'd get a "port already in use" error.

By using 3001, we can run both apps simultaneously:
- `http://localhost:3000` → Main douala app
- `http://localhost:3001` → Our learning app

**This is a common pattern** when developing multiple related applications locally.

---

## Answer 6: Dependencies vs DevDependencies

### a) What's the difference?

| `dependencies` | `devDependencies` |
|----------------|-------------------|
| Required at runtime | Only needed during development |
| Included in production build | NOT included in production |
| Your app breaks without them | Your app runs fine without them |

### b) Why is TypeScript in devDependencies?

TypeScript is only used during **development** to:
- Type-check your code
- Compile `.ts` files to `.js`

At runtime, the browser/server only runs **JavaScript** (the compiled output). TypeScript itself is never executed in production.

```
Development                          Production
┌─────────────┐                     ┌─────────────┐
│ app.ts      │   tsc compile       │ app.js      │
│ (TypeScript)│ ──────────────────▶ │ (JavaScript)│
└─────────────┘                     └─────────────┘
   ↑                                      ↑
TypeScript needed here            TypeScript NOT needed here
```

Similarly, `@types/*` packages provide type definitions for development but aren't needed at runtime.

---

## Answer 7: True or False

### 1. "The `livekit-client` package can generate authentication tokens."
**FALSE**

`livekit-client` is for **using** tokens, not creating them. Token generation requires the API secret, which only the server should have. The client package connects to rooms using tokens created by the server.

### 2. "Tokens contain information about which room a user can join."
**TRUE**

A LiveKit token includes a "grant" that specifies:
- Which room the token is valid for (`room: "my-room"`)
- Whether the user can join (`roomJoin: true`)
- What permissions they have (`canPublish`, `canSubscribe`, etc.)

You can see this by decoding a token at https://jwt.io

### 3. "The browser needs the `LIVEKIT_API_SECRET` to connect to a room."
**FALSE**

The browser only needs:
- The **token** (which was signed with the secret on the server)
- The **LiveKit server URL** (`wss://your-project.livekit.cloud`)

The secret stays on your server. The token proves the user was authorized by your server without exposing the secret.

---

## Bonus Answer

**Neither `livekit-client` nor `livekit-server-sdk`** - you would use:
- **iOS**: `livekit-swift` (Swift SDK)
- **Android**: `livekit-android` (Kotlin SDK)

LiveKit provides native SDKs for each platform:
- `livekit-client` → JavaScript/TypeScript (Web browsers)
- `livekit-swift` → iOS/macOS
- `livekit-android` → Android
- `livekit-flutter` → Flutter (cross-platform)
- `livekit-react-native` → React Native

However, you would still use `livekit-server-sdk` (or equivalent) on your **backend** to generate tokens. The server-side token generation is the same regardless of which client platform you're using.

```
                    Your Server
                    (livekit-server-sdk)
                          │
                          │ Generates tokens for all clients
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   Web Browser       iOS App          Android App
  (livekit-client)  (livekit-swift)  (livekit-android)
```

---

## Summary: Key Takeaways from Step 1

1. **Two packages, two purposes**: `livekit-client` for browsers, `livekit-server-sdk` for servers
2. **Tokens are server-side only**: Never expose your API secret to the browser
3. **The flow**: Browser → requests token → Server creates token → Browser connects with token
4. **Security first**: The separation exists primarily for security reasons

---

**Ready for Step 2? Move on to create the TypeScript and Next.js config files!**
