import { NextResponse } from 'next/server';

export const revalidate = 0;

export interface Command {
  command: string;
  description: string;
  example: string;
}

const DEFAULT_COMMANDS: Command[] = [
  { command: '/help', description: 'Show available commands', example: '/help' },
  { command: '/clear', description: 'Clear the chat transcript', example: '/clear' },
  { command: '/voice', description: 'Switch to voice-only mode', example: '/voice' },
  { command: '/realtime', description: 'Switch to real-time mode', example: '/realtime' },
  { command: '/call', description: 'Initiate a call', example: '/call' },
  { command: '/imgstream', description: 'Start an image stream', example: '/imgstream' },
];

export async function GET() {
  const apiEndpoint = process.env.COMMANDS_API_ENDPOINT;

  if (apiEndpoint) {
    try {
      const res = await fetch(apiEndpoint, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        console.warn(`Commands API returned ${res.status}, falling back to defaults`);
        return NextResponse.json({ commands: DEFAULT_COMMANDS });
      }

      const data = await res.json();
      const commands = Array.isArray(data.commands ?? data.data ?? data)
        ? (data.commands ?? data.data ?? data)
        : DEFAULT_COMMANDS;

      return NextResponse.json({ commands });
    } catch (error) {
      console.warn('Failed to fetch commands from API, falling back to defaults:', error);
      return NextResponse.json({ commands: DEFAULT_COMMANDS });
    }
  }

  return NextResponse.json({ commands: DEFAULT_COMMANDS });
}
