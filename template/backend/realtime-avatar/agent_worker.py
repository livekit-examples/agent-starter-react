import logging
import os

from PIL import Image
import json

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli
from livekit.plugins import hedra, openai, elevenlabs, silero
from pprint import pformat

logger = logging.getLogger("hedra-avatar-example")
logger.setLevel(logging.INFO)

# https://elevenlabs.io/app/voice-library?voiceId=XB0fDUnXU5powFXDhCwa -> voice_id for forest
# https://elevenlabs.io/app/voice-library?voiceId=z9fAnlkpzviPz146aGWa -> voice_id for restaurant
# https://elevenlabs.io/app/voice-library?voiceId=P7x743VjyZEOihNNygQ9 -> voice_id for home
# https://elevenlabs.io/app/voice-library?voiceId=bIHbv24MWmeRgasZH58o -> voice_id for business

voices = {
    "forest":"XB0fDUnXU5powFXDhCwa",
    "restaurant":"z9fAnlkpzviPz146aGWa",
    "home":"P7x743VjyZEOihNNygQ9",
    "business":"bIHbv24MWmeRgasZH58o",
}

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    api_key = None
    hedra_avatar = None
    hedra_avatar_asset_id = None
    eleven_voice = None

    for identity, participant in ctx.room._remote_participants.items():
        metadata_str = participant._info.metadata
        if metadata_str:
            try:
                metadata = json.loads(metadata_str)
                api_key = metadata.get("hedra_api_key")
                hedra_avatar = metadata.get("hedra_avatar")
                hedra_avatar_asset_id = metadata.get("hedra_avatar_asset_id")
                eleven_voice = metadata.get("eleven_voice")
            except Exception as e:
                logger.error("Failed to parse metadata for %s: %s", identity, e)
        break  # Only process the first remote participant

    voice_id = None
    # hedra avatar will be passed in when user uses one of our example avatar images and avatar id when they upload their own image
    if hedra_avatar and hedra_avatar != "custom":
        avatar_image = Image.open(os.path.join(os.path.dirname(__file__), f"assets/{hedra_avatar}.png"))
        voice_id = voices[hedra_avatar]
    else:
        avatar_image = Image.open(os.path.join(os.path.dirname(__file__), "assets/forest.png"))
        voice_id = eleven_voice if eleven_voice else voices["forest"]

    session = AgentSession(
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=elevenlabs.TTS(model="eleven_flash_v2_5", voice_id=voice_id),
        stt=openai.STT(model="whisper-1"),
        vad=silero.VAD.load(),
    )

    if hedra_avatar_asset_id:
        hedra_avatar = hedra.AvatarSession(avatar_id=hedra_avatar_asset_id, api_key=api_key)
    else:
        hedra_avatar = hedra.AvatarSession(avatar_image=avatar_image, api_key=api_key)

    await hedra_avatar.start(session, room=ctx.room)

    await session.start(
          room=ctx.room,
    )

    session.generate_reply(instructions="say hello to the user")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, worker_type=WorkerType.ROOM))
