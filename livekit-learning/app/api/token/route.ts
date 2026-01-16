import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

/**
 * TOKEN GENERATION ENDPOINT
 *
 * This endpoint creates JWT tokens that allow clients to connect to LiveKit rooms.
 *
 * Key concepts:
 * 1. AccessToken - The main class from livekit-server-sdk that creates tokens
 * 2. Identity - A unique identifier for the participant (like a username)
 * 3. Room grants - Permissions specifying which room to join and what actions are allowed
 *
 * The token is signed with your API secret, so only your server can create valid tokens.
 * Clients cannot forge tokens because they don't have the secret.
 */
export async function GET(request: NextRequest) {
  // Get room name and user identity from query parameters
  const searchParams = request.nextUrl.searchParams;
  const roomName = searchParams.get('room');
  const userName = searchParams.get('user');

  // Validate required parameters
  if (!roomName) {
    return NextResponse.json(
      { error: 'Missing "room" query parameter. Example: /api/token?room=my-room&user=alice' },
      { status: 400 }
    );
  }

  if (!userName) {
    return NextResponse.json(
      { error: 'Missing "user" query parameter. Example: /api/token?room=my-room&user=alice' },
      { status: 400 }
    );
  }

  // Check environment variables
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      {
        error: 'Missing LiveKit credentials. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL in .env.local',
        hint: 'Get free credentials at https://cloud.livekit.io',
      },
      { status: 500 }
    );
  }

  try {
    // Create an access token
    // The token is signed with your API secret, making it impossible to forge
    const token = new AccessToken(apiKey, apiSecret, {
      // Identity is how this participant will be identified in the room
      // Other participants will see this identity
      identity: userName,

      // Optional: Human-readable name (can be different from identity)
      name: userName,

      // Token expires after 1 hour
      // After expiration, the client will be disconnected
      ttl: '1h',
    });

    // Add room grant - this specifies what the token holder can do
    token.addGrant({
      // Which room this token is valid for
      room: roomName,

      // Can join the room?
      roomJoin: true,

      // Can publish audio? (microphone)
      canPublish: true,

      // Can publish data messages? (for chat, etc.)
      canPublishData: true,

      // Can subscribe to other participants' tracks?
      canSubscribe: true,
    });

    // Generate the JWT string
    const jwt = await token.toJwt();

    // Return the token and server URL
    return NextResponse.json(
      {
        token: jwt,
        url: livekitUrl,

        // Include some debug info
        _debug: {
          room: roomName,
          identity: userName,
          expiresIn: '1 hour',
          permissions: {
            canPublish: true,
            canPublishData: true,
            canSubscribe: true,
          },
        },
      },
      {
        // Never cache tokens - they should be generated fresh each time
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token', details: String(error) },
      { status: 500 }
    );
  }
}
