import json
from typing import Any

from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli

MOCK_SESSIONS: list[dict[str, Any]] = [
    {
        "id": "1",
        "title": "Getting Started with AI",
        "preview": "How to use the agent effectively for daily tasks...",
        "updatedAt": "2026-05-23T10:30:00Z",
    },
    {
        "id": "2",
        "title": "Project Architecture Review",
        "preview": "Discussing the microservices migration strategy and API design patterns...",
        "updatedAt": "2026-05-22T14:20:00Z",
    },
    {
        "id": "3",
        "title": "Bug Investigation: Login Issue",
        "preview": "Debugging the authentication flow and session management...",
        "updatedAt": "2026-05-21T09:15:00Z",
    },
]


async def clear_chat_for_participant(participant: rtc.RemoteParticipant) -> None:
    """Call the 'clear_chat' RPC on a connected frontend participant."""
    try:
        await participant.perform_rpc(
            method="clear_chat",
            payload="",
            response_timeout=5.0,
        )
        print(f"cleared chat for {participant.identity}")
    except Exception as e:
        print(f"failed to clear chat for {participant.identity}: {e}")


def find_frontend_participants(room: rtc.Room) -> list[rtc.RemoteParticipant]:
    """Return remote participants that are likely frontend clients."""
    return [
        p
        for p in room.remote_participants.values()
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD
    ]


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # --- Register RPC to handle 'get_sessions' calls from the frontend ---
    async def get_sessions(data: str) -> str:
        body = json.loads(data)
        limit = body.get("limit")
        sessions = MOCK_SESSIONS
        if limit is not None and isinstance(limit, int):
            sessions = sessions[:limit]
        return json.dumps({"sessions": sessions})

    ctx.room.local_participant.register_rpc_method("get_sessions", get_sessions)
    print("agent ready — 'get_sessions' RPC method registered")

    # --- Register RPC to receive the user's geolocation from the frontend ---
    async def set_user_location(data: str) -> str:
        body = json.loads(data)
        print(f"received user location: {body}")
        return json.dumps({"success": True})

    ctx.room.local_participant.register_rpc_method("setUserLocation", set_user_location)
    print("agent ready — 'setUserLocation' RPC method registered")

    # --- Example: watch for new participants and register callbacks ---
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        print(f"participant connected: {participant.identity}")

        # Example: clear chat for this participant after 60 seconds
        # import asyncio
        # asyncio.ensure_future(_delayed_clear(participant))

        # Example: send custom commands to this participant via RPC
        # asyncio.ensure_future(_send_commands(participant))

    # async def _delayed_clear(participant: rtc.RemoteParticipant) -> None:
    #     await asyncio.sleep(60)
    #     await clear_chat_for_participant(participant)

    # async def _send_commands(participant: rtc.RemoteParticipant) -> None:
    #     """Call the 'update_commands' RPC to replace the frontend's command list."""
    #     custom_commands = [
    #         {"command": "/help", "description": "Show available commands", "example": "/help"},
    #         {"command": "/docs", "description": "Open documentation", "example": "/docs"},
    #         {"command": "/status", "description": "Check system status", "example": "/status"},
    #         {"command": "/feedback", "description": "Send feedback", "example": "/feedback great work"},
    #         {"command": "/reset", "description": "Reset the conversation", "example": "/reset"},
    #     ]
    #     try:
    #         await participant.perform_rpc(
    #             method="update_commands",
    #             payload=json.dumps({"commands": custom_commands}),
    #             response_timeout=5.0,
    #         )
    #         print(f"sent commands to {participant.identity}")
    #     except Exception as e:
    #         print(f"failed to send commands to {participant.identity}: {e}")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
