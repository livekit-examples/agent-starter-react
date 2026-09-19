import { NextResponse } from 'next/server';

export const revalidate = 0;

const BEARER_KEY = process.env.CHAT_API_BEARER_KEY;

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function authenticate(req: Request): { error?: NextResponse } {
  if (!BEARER_KEY) {
    return {
      error: NextResponse.json(
        { error: 'Chat API bearer key is not configured on the server' },
        { status: 500 }
      ),
    };
  }

  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or malformed Authorization header. Use: Bearer <token>' },
        { status: 401 }
      ),
    };
  }

  const token = auth.slice(7);
  if (token !== BEARER_KEY) {
    return { error: NextResponse.json({ error: 'Invalid bearer token' }, { status: 403 }) };
  }

  return {};
}

const mockSessions: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Getting Started with AI',
    createdAt: '2026-05-23T10:30:00Z',
    updatedAt: '2026-05-23T10:35:00Z',
    messages: [
      {
        id: 'm1',
        sessionId: 'session-1',
        role: 'user',
        content: 'How do I get started with this AI agent?',
        timestamp: '2026-05-23T10:30:00Z',
      },
      {
        id: 'm2',
        sessionId: 'session-1',
        role: 'assistant',
        content:
          'Welcome! To get started, simply click the "Open Portal" button to connect. Once connected, you can ask me anything about your daily tasks, project management, or code-related questions.',
        timestamp: '2026-05-23T10:30:05Z',
      },
      {
        id: 'm3',
        sessionId: 'session-1',
        role: 'user',
        content: 'Can you help me with code review?',
        timestamp: '2026-05-23T10:31:00Z',
      },
      {
        id: 'm4',
        sessionId: 'session-1',
        role: 'assistant',
        content:
          "Absolutely! Share the code you'd like reviewed and I can analyze it for bugs, style issues, and suggest improvements.",
        timestamp: '2026-05-23T10:31:05Z',
      },
    ],
  },
  {
    id: 'session-2',
    title: 'Project Architecture Review',
    createdAt: '2026-05-22T14:20:00Z',
    updatedAt: '2026-05-22T14:45:00Z',
    messages: [
      {
        id: 'm5',
        sessionId: 'session-2',
        role: 'user',
        content: 'We need to discuss our microservices migration strategy.',
        timestamp: '2026-05-22T14:20:00Z',
      },
      {
        id: 'm6',
        sessionId: 'session-2',
        role: 'assistant',
        content:
          "I'd be happy to help with that. What's the current architecture and what are your goals with the migration?",
        timestamp: '2026-05-22T14:20:10Z',
      },
      {
        id: 'm7',
        sessionId: 'session-2',
        role: 'user',
        content: 'We have a monolithic Node.js app and want to split it into services.',
        timestamp: '2026-05-22T14:25:00Z',
      },
      {
        id: 'm8',
        sessionId: 'session-2',
        role: 'assistant',
        content:
          'Great approach. I recommend starting with the bounded context mapping technique. Which module do you want to extract first?',
        timestamp: '2026-05-22T14:25:15Z',
      },
    ],
  },
  {
    id: 'session-3',
    title: 'Bug Investigation: Login Issue',
    createdAt: '2026-05-21T09:15:00Z',
    updatedAt: '2026-05-21T09:30:00Z',
    messages: [
      {
        id: 'm9',
        sessionId: 'session-3',
        role: 'user',
        content: 'Users are reporting login failures after the latest deployment.',
        timestamp: '2026-05-21T09:15:00Z',
      },
      {
        id: 'm10',
        sessionId: 'session-3',
        role: 'assistant',
        content:
          "Let's investigate. Can you check if there are any recent changes to the authentication middleware or session handling?",
        timestamp: '2026-05-21T09:15:10Z',
      },
      {
        id: 'm11',
        sessionId: 'session-3',
        role: 'user',
        content: 'We updated the JWT library version.',
        timestamp: '2026-05-21T09:20:00Z',
      },
      {
        id: 'm12',
        sessionId: 'session-3',
        role: 'assistant',
        content:
          "That could be it. Let's verify the token signing and validation logic. Can you share the error logs?",
        timestamp: '2026-05-21T09:20:15Z',
      },
    ],
  },
];

export async function POST(req: Request) {
  try {
    const auth = authenticate(req);
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const { sessionId, limit } = body;

    let sessions = [...mockSessions];

    if (sessionId) {
      sessions = sessions.filter((s) => s.id === sessionId);
    }

    if (limit && typeof limit === 'number') {
      sessions = sessions.slice(0, limit);
    }

    const headers = new Headers({ 'Cache-Control': 'no-store' });
    return NextResponse.json({ sessions }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
