# VOOPA Render Check

**Your video is a signal.** Render Check is a Signal Labs tool that an agent can call after a generated video misses its brief and before anyone pays for another take. It returns timestamped evidence and recommends whether to edit the take, try one specific change, switch approach, or review the evidence again.

This developer preview runs locally. It uses the calling host’s visual review or its reviewer’s observations. The local preview can read an existing fal video result. The hosted World Engine review is in development.

## Run the preview

Requirements are Node.js 22 or later and FFmpeg with ffprobe. Run:

```sh
npm ci
npm test
npm run mcp:http
```

The test generates its own one-second clip. The server listens at `http://127.0.0.1:50951/mcp` and accepts only local connections. For a process-based MCP host, launch `node /absolute/path/to/mcp.mjs` instead.

Pass a direct HTTPS video URL from an existing fal result as `falVideoUrl`, or pass the filename of an authorized local clip in the `intake` folder as `file`. A fal result is fetched from the supported fal media hosts, sampled, and the temporary clip is removed. This uses no generation credits.

## Connect a workflow

| Host | Connection route |
| --- | --- |
| Claude | The Claude API MCP connector can reach hosted HTTPS servers. For a local coding workflow, configure the server in Claude Code. [Claude MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) |
| Mistral | Mistral Studio can register a hosted MCP server as a connector for conversations and agents. [Mistral connectors](https://docs.mistral.ai/studio/connectors/overview) |
| Qwen | Qwen-Agent supports Streamable HTTP MCP. Connect through the agent runtime. [Qwen-Agent releases](https://github.com/QwenLM/Qwen-Agent/releases) |
| Other models | An MCP-capable agent host can list and invoke the tools. A host that exposes model function calling can bridge those calls to MCP. Image review needs a vision-capable model or reviewer. |

The test verifies the MCP protocol with an independent client. The hosted provider integrations above are documented routes and still need live verification.

## Tell the agent when to use it

> When a paid video take misses the brief, use VOOPA Render Check before proposing another generation. Reuse the existing clip, prompt, and attempt history. Show the timestamp and one actionable recommendation in chat. Hold spending if the evidence is unclear.

Start with `review_completed_render`. Give it the clip or the `video.url` from the fal result, the must-haves, and prior attempts. A compatible process-based host can use model sampling. Over the local HTTP preview the host receives frames and calls `decide_render_retry` with its observations. Text-only hosts can use trusted observations supplied by a reviewer or separate vision component.

## What this preview proves

The same tool interface works over local process and Streamable HTTP connections. The included smoke test exercises an inspect-and-decide flow without credentials or generation costs. The policy and evidence can be tested independently of a specific model. Nothing in the tool starts a render or authorizes spending.
