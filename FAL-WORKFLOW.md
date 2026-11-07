# Check a fal take before paying for another

VOOPA Render Check is a Signal Labs tool for agents working with generated video. Use it when a completed take misses a specific requirement and another generation would cost money. It examines the existing take using frames interpreted by your agent or observations supplied by a reviewer.

## Connect

Add a Streamable HTTP MCP server at `https://voopa-render-check.onrender.com/mcp` in your agent host. The free preview needs no credentials. The first request after inactivity can be slower. If your host uses a tool bridge, point its MCP client at the same endpoint.

For paid access, the account owner can buy 50 review credits for US$5 at [Render Check Credits](https://voopa-render-check.onrender.com/credits). Configure `https://voopa-render-check.onrender.com/mcp/paid` with the header `Authorization: Bearer <private Render Check key>`. Store the key in the host’s private configuration. Keep it out of prompts and version control. Use a host or bridge that supports custom authorization headers.

## Give the agent this instruction

> Before requesting another paid video generation, use VOOPA Render Check on the completed take. Pass the fal result’s existing video URL, the original brief, the must-haves and the prior attempts. Inspect the returned frames against each must-have, then ask Render Check for a recommendation. Show me the timestamp, what went wrong and the suggested next step. Ask me before generating again or buying review credits.

1. Call `review_completed_render` with the existing `falVideoUrl`, `take`, `brief`, `requirements` and `previousAttempts`. Set `historyComplete` only if you know the full attempt history. Use timestamps to check a particular moment.
2. Check the returned frames. Mark each requirement pass, fail or uncertain and cite where you saw it. If the frames cannot establish movement or an exact sequence, mark it uncertain and sample the relevant interval.
3. Call `decide_render_retry` with the review context and observations. Supply an edit only when the assets can support it, or propose a retry only when there is a specific untried change.
4. On the paid endpoint, supply a stable `reviewId` per decision and reuse it after transport failures. A completed decision uses one credit. The agent never purchases credits or starts a generation on its own.

For example, if three blue blocks become six, or they land outside the grid, check those as separate requirements. A take can pass the count check and still fail placement. If exact placement has failed repeatedly, compare a controlled animation or compositing pass with the cost of another speculative generation.
