# Connect Render Check to your AI assistant

Review a completed AI image or video before spending on another attempt. The hosted preview is rate-limited; [plans and credits](https://voopa-render-check.onrender.com/plans) are available for paid checks. Send only media you are authorized to share; see our [privacy notice](https://voopa-render-check.onrender.com/privacy).

## ChatGPT and Claude

**ChatGPT:** If VOOPA Render Check is available to connect in your account, enable it in Plugins and ask it to review your completed clip. A custom MCP connection may also be possible depending on your plan and workspace settings; see [OpenAI’s connection instructions](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt). Public listing availability is separate from private testing.

**Claude:** [Connect Render Check and add the skill](CLAUDE-SKILL.md). Claude may ask for permission before the tool runs.

On 19 November 2026, configured ChatGPT, Claude, Cursor and Mistral accounts each called the black-gap tool on the public sample below and reported its 3–4 second gap. This confirms that specific check in those sessions; it does not guarantee discovery or results for every clip.

## Cursor

In Cursor, open **Customize → MCPs → New → User** and add this server URL:

    https://voopa-render-check.onrender.com/mcp

Or use the [Cursor community directory listing](https://cursor.directory/plugins/voopa-render-check), or follow the [Cursor configuration in the README](README.md#connect-to-the-hosted-preview). In one configured-account test, Cursor chose Render Check without being named and found the deliberate black gap in our public sample. Marketplace approval and unconfigured-user discovery are separate.

## Google Antigravity (Gemini)

Google directs individual Gemini CLI users to Antigravity. In a trusted project, create `.agents/mcp_config.json` with the following contents:

    {
      "mcpServers": {
        "voopa-render-check": {
          "serverUrl": "https://voopa-render-check.onrender.com/mcp"
        }
      }
    }

Open Antigravity CLI in that project and use `/mcp` to inspect the connection. See [Google's MCP setup](https://antigravity.google/docs/cli/mcp/) and [individual-account migration notice](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals). In one configured-account test, Antigravity CLI called Render Check and identified the deliberate black gap at 3–4 seconds in our sample video. This does not install a consumer Gemini app listing.

## Grok

In [Grok connectors](https://grok.com/connectors), select **Add a custom connector** and enter `https://voopa-render-check.onrender.com/mcp`. Account and workspace permissions may apply. See [Grok’s connector instructions](https://docs.x.ai/grok/connectors). On 19 November 2026, Grok called the connected Render Check black-gap tool on the public sample below and identified the gap at 3–4 seconds. This is a custom connection, not a catalog listing.

## Mistral Vibe

Open **Connectors → All → New connector → Add custom connector**, enter `VOOPA Render Check` and `https://voopa-render-check.onrender.com/mcp`, select the detected authentication option and add it. In one configured-account test, Mistral called Render Check and found the deliberate black gap at 3–4 seconds in our sample video. This is a custom connection, not a marketplace listing.

## HuggingChat

In HuggingChat, open **MCP Servers → Add Server**, enter `VOOPA Render Check` and `https://voopa-render-check.onrender.com/mcp`, then enable it and use **Health Check**. On 19 November 2026, the server connected and HuggingChat displayed 18 tools. A Qwen model review was attempted but the account message limit prevented a completed test. Model availability and usage limits vary.

## Qwen Code

In your project, run:

    qwen mcp add --scope project --transport http voopa-render-check https://voopa-render-check.onrender.com/mcp
    qwen mcp approve voopa-render-check
    qwen mcp list

We verified that Qwen Code 0.28.0 connects to the hosted server. An end-to-end model review still requires a configured provider. This is Qwen Code, not a Qwen Chat listing. See [Qwen's MCP instructions](https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/mcp.md).

## Claude and other MCP hosts

[Install the Claude skill and connector](CLAUDE-SKILL.md), or point a compatible Streamable HTTP MCP client to the server URL above. Individual host, model, image-display and authentication behavior varies. Connecting a server does not guarantee automatic tool selection.

## Try it

Ask your configured assistant: “Before I pay for another render, check this video for a black gap and suggest the next step: https://raw.githubusercontent.com/Voopa-Corp/render-check/main/black-gap-demo.mp4. Do not generate anything.” The synthetic clip contains a deliberate black gap around 3–4 seconds. Review reported findings; sampled frames and automated checks can miss issues or flag intentional material. [See the capability chart](CAPABILITIES.md).


## Use alongside Runway

Runway offers an [MCP connector](https://help.runwayml.com/hc/en-us/articles/51931843164691-Connecting-to-Runway-MCP) for supported assistants. Connect Runway and Render Check separately in the same compatible assistant, subject to the host’s permissions. Generate or provide a completed image or clip with Runway, then ask the assistant to use Render Check before starting another generation.

Try: “Review my completed Runway clip against the brief using Render Check. Flag issues and suggest whether to keep, edit, or retry. Do not generate another clip without asking me.” Provide a media URL the checker can access and share only media you have permission to use. Runway generation uses Runway credits; the Render Check preview is separately rate-limited.

This is a suggested two-connector workflow. We have not yet verified the complete Runway-to-Render Check flow, and connection does not imply a Runway endorsement or automatic tool selection.
