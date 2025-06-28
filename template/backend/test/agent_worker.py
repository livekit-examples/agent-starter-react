import logging
import os

from PIL import Image

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli
from livekit.plugins import hedra, openai
from pprint import pformat


logger = logging.getLogger("hedra-avatar-example")
logger.setLevel(logging.INFO)

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    # logger.info("room fields:\n%s", pformat(ctx.room.__dict__))
    # logger.info("local_participant fields:\n%s", pformat(ctx.room.local_participant.__dict__))
    # logger.info("local_participant attributes:\n%s", pformat(ctx.room.local_participant.attributes))
    # logger.info("------------------------------------------------------------------")
    # metadata_str = ctx.room.local_participant._info.metadata
    # logger.info("metadata_str:\n%s", metadata_str)
    # for identity, participant in ctx.room._remote_participants.items():
    #     logger.info("Remote participant %s metadata: %s", identity, participant._info.metadata)

    session = AgentSession(
        # List of voices here: https://www.openai.fm/
        llm=openai.realtime.RealtimeModel(voice="ash"),
    )

    # upload an avatar image or use an avatar id from hedra
    avatar_image = Image.open(os.path.join(os.path.dirname(__file__), "assets/fred.png"))
    hedra_avatar = hedra.AvatarSession(avatar_image=avatar_image)
    await hedra_avatar.start(session, room=ctx.room)

    await session.start(
        agent=Agent(instructions="Talk to me!"),
        room=ctx.room,
    )

    session.generate_reply(instructions="say hello to the user")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, worker_type=WorkerType.ROOM))
