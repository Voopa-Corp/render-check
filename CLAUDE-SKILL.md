# Use Render Check with Claude

Give Claude a repeatable way to review an existing image or video before suggesting another paid render. The hosted preview is free and rate-limited.

1. [Download the Render Check skill](https://github.com/Voopa-Corp/render-check/raw/refs/heads/main/render-check-claude-skill.zip).
2. In Claude, open **Plugins**, choose **Add → Upload plugin**, and upload the ZIP as a skill. Claude should show **Render check** as added. Menu names may vary by account.
3. Connect the VOOPA Render Check MCP server in Claude using the URL `https://voopa-render-check.onrender.com/mcp`. Claude may ask you to approve the connection and individual tool calls. Availability depends on your Claude account and current platform features.
4. In a new conversation, provide the completed clip or image and your brief. For example: “This take misses my brief. Before I pay for another render, review the existing clip and suggest what to do next.”

The skill supplies instructions; the connector supplies the tools. Installing the skill alone does not connect the service, and a host decides whether and when to use it. The clip is sent to the service for inspection, so share only media you are authorized to share. [Privacy notice](https://voopa-render-check.onrender.com/privacy).

In our test, Claude selected the connected tool for a faulty-video request without being named, found a synthetic black gap and suggested editing before another render. This is one controlled example, not proof of savings or a guarantee on all footage. A review of sampled frames does not verify the entire video, lip sync or sound.

Developers using Claude Code, Codex, Cursor or other skill-compatible hosts can use the same [skill folder](skills/render-check) with the [MCP setup](README.md#add-render-check-to-your-agent). Support and setup vary across hosts; a model name alone does not establish connector compatibility.
