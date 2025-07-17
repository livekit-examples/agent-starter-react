## Overview

A Next.js frontend for a simple AI voice assistant using LiveKit's official [JavaScript SDK](https://github.com/livekit/client-sdk-js) and [React Components](https://github.com/livekit/components-js). The application implements its own token server, and supports [voice](https://docs.livekit.io/agents/start/voice-ai/), [transcription](https://docs.livekit.io/agents/build/text/), and [virtual avatars](https://docs.livekit.io/agents/integrations/avatar/).

## Sandbox

When deployed in a sandbox, LiveKit will host an instance of this application for you, providing a unique, shareable URL through which you can access it. Any agents running with the same LiveKit project credentials will join, meaning that you can rapidly iterate on your agent prototypes, and share the results instantly with friends and colleagues. To begin testing your agent, deploy this app in sandbox then set up an agent on your local machine using the [Voice AI Quickstart](https://docs.livekit.io/start/voice-ai):

## Installation

To run this application locally, clone the repo or use the [LiveKit CLI](https://docs.livekit.io/home/cli/cli-setup/):

```console
lk app create --template agent-starter-react
```

For more information on prototyping using LiveKit Sandbox, see the [documentation](https://docs.livekit.io/home/cloud/sandbox/).
