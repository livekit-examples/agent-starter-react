import Link from 'next/link';

export default function Home() {
  return (
    <div className="container">
      <h1>LiveKit Learning</h1>
      <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
        Learn LiveKit fundamentals by building a simple video room.
      </p>

      <div className="card" style={{ marginTop: '2rem', background: '#fffbeb' }}>
        <h2>Before You Start</h2>
        <p style={{ marginTop: '0.5rem' }}>
          Make sure you have set up your <code>.env.local</code> file with your LiveKit credentials.
          See <code>.env.example</code> for the required variables.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <strong>Need credentials?</strong> Get them free at{' '}
          <a href="https://cloud.livekit.io" target="_blank" rel="noopener">
            cloud.livekit.io
          </a>
        </p>
      </div>

      <h2 style={{ marginTop: '2rem' }}>Core Concepts</h2>

      <div className="concept">
        <h3>1. Rooms</h3>
        <p>
          A Room is a virtual space where participants meet. Think of it like a video call room.
          Each room has a unique name, and participants join by connecting to that room.
        </p>
      </div>

      <div className="concept">
        <h3>2. Participants</h3>
        <p>
          Anyone connected to a room is a Participant. There are two types: the Local Participant
          (you) and Remote Participants (everyone else, including AI agents).
        </p>
      </div>

      <div className="concept">
        <h3>3. Tracks</h3>
        <p>
          Tracks are audio or video streams. When you turn on your camera, you &quot;publish&quot;
          a video track. When someone else has their camera on, you &quot;subscribe&quot; to their
          track.
        </p>
      </div>

      <div className="concept">
        <h3>4. Tokens</h3>
        <p>
          Tokens are JWT (JSON Web Tokens) that authenticate you. They contain your identity (who
          you are), the room you can join, and what permissions you have (can you publish video?
          audio?).
        </p>
      </div>

      <div className="concept">
        <h3>5. Events</h3>
        <p>
          LiveKit uses events to notify you when things happen: someone joins, someone leaves, a
          track is published, etc. Your app listens for these events and updates the UI
          accordingly.
        </p>
      </div>

      <h2 style={{ marginTop: '2rem' }}>Architecture Overview</h2>

      <pre>
        <code>{`┌─────────────────────────────────────────────────────────────┐
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
└───────────────┘               └───────────────┘`}</code>
      </pre>

      <h2 style={{ marginTop: '2rem' }}>Try It Out</h2>

      <div className="card">
        <h3>Test Token Generation</h3>
        <p style={{ marginTop: '0.5rem' }}>
          First, verify your credentials work by checking the token endpoint:
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <code>
            <a href="/api/token?room=test-room&user=alice" target="_blank">
              /api/token?room=test-room&user=alice
            </a>
          </code>
        </p>
        <p style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>
          You should see a JSON response with <code>token</code> and <code>url</code>.
        </p>
      </div>

      <div className="card">
        <h3>Join a Room</h3>
        <p style={{ marginTop: '0.5rem' }}>
          Once tokens work, try joining a room:
        </p>
        <Link href="/room?name=my-test-room" className="button button-primary" style={{ marginTop: '1rem' }}>
          Join Test Room →
        </Link>
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>
          Tip: Open the same room in two browser tabs to see multi-participant features.
        </p>
      </div>

      <h2 style={{ marginTop: '2rem' }}>How Agents Fit In</h2>

      <div className="concept">
        <h3>AI Agents are Just Participants</h3>
        <p>
          An AI agent is simply another participant that connects to the room. The difference is
          that instead of a human controlling it, code controls it. The agent subscribes to your
          audio track, processes it (speech-to-text → LLM → text-to-speech), and publishes audio
          back.
        </p>
      </div>

      <pre>
        <code>{`User speaks
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
You hear the response`}</code>
      </pre>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Next Steps</h3>
        <ol style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
          <li>
            Get your credentials from{' '}
            <a href="https://cloud.livekit.io" target="_blank" rel="noopener">
              LiveKit Cloud
            </a>
          </li>
          <li>
            Create <code>.env.local</code> with your keys
          </li>
          <li>Test the token endpoint</li>
          <li>Join a room and see your video</li>
          <li>Open two tabs to the same room</li>
          <li>
            Check out the main <code>douala</code> app to see agent integration
          </li>
        </ol>
      </div>
    </div>
  );
}
