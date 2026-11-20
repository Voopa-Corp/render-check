# Check a fal take before paying for another

VOOPA Render Check is a Signal Labs tool for agents working with generated video. Use it when a completed take misses a specific requirement and another generation would cost money. It examines the existing take using frames interpreted by your agent or observations supplied by a reviewer.

## Connect

Add a Streamable HTTP MCP server at `https://voopa-render-check.onrender.com/mcp` in your agent host. The free preview needs no credentials. The first request after inactivity can be slower. If your host uses a tool bridge, point its MCP client at the same endpoint.

For paid usage, create or recover an account at [Render Check Plans](https://voopa-render-check.onrender.com/plans), then connect `https://voopa-render-check.onrender.com/mcp/usage` with `Authorization: Bearer <private Render Check key>`. Keep the key in the host's secret store. The $5 monthly plan includes 250 usage units; a video review costs 5 units per started 5 seconds. See [agent billing](AGENT-BILLING.md) for current packs and recovery.

## Give the agent this instruction

> Before requesting another paid video generation, use VOOPA Render Check on the completed take. Pass the fal result’s existing video URL, the original brief, the must-haves and the prior attempts. Inspect the returned frames against each must-have, then ask Render Check for a recommendation. Show me the timestamp, what went wrong and the suggested next step. Ask me before generating again or buying review credits.

1. Call `review_completed_render` with the existing `falVideoUrl`, `take`, `brief`, `requirements` and `previousAttempts`. Set `historyComplete` only if you know the full attempt history. Use timestamps to check a particular moment.
2. Check the returned frames. Mark each requirement pass, fail or uncertain and cite where you saw it. If the frames cannot establish movement or an exact sequence, mark it uncertain and sample the relevant interval.
3. Call `decide_render_retry` with the review context and observations. Supply an edit only when the assets can support it, or propose a retry only when there is a specific untried change.
4. For the usage-based endpoint, call `review_metered_video` with a unique stable `operationId`, then `decide_metered_retry` with that same ID and the returned review context. The decision does not charge again. The agent never purchases credits or starts a generation on its own.

For example, if three blue blocks become six, or they land outside the grid, check those as separate requirements. A take can pass the count check and still fail placement. If exact placement has failed repeatedly, compare a controlled animation or compositing pass with the cost of another speculative generation.


## Run the same decision in n8n

[Download the workflow JSON](https://raw.githubusercontent.com/Voopa-Corp/render-check/main/render-check-n8n.json). Import it in n8n with **Import from File**, then run **Run puppy example**. It sends the demo observations to the public MCP endpoint and should return `edit_first`.

To reuse it in a video pipeline, add an **Execute Sub-workflow** step after the render succeeds. Pass the following fields from the render and the original shot brief:

```json
{
  "take": "scene-03-take-02",
  "brief": "Keep the singer and camera angle consistent. The approved vocal plays throughout.",
  "renderVideoUrl": "<completed video URL>",
  "requirements": [{ "id": "angle", "description": "Camera stays in the approved position." }],
  "expectedAudio": { "fromSeconds": 0, "toSeconds": 7.2 }
}
```

Use the actual audio interval expected for that shot. If the result asks for
`decide_render_retry`, send its `evidence` to a vision-capable reviewer and
call the same sub-workflow again with the review context and observations.
Omit the video URL in that second call or when the workflow already has
observations. Route any paid retry to approval.

## Call from a paid Node video workflow

The current usage-based endpoint works with `metered-workflow.mjs`. Keep the returned review and frames for the vision-capable agent; the server may report an already-completed operation without returning its frames on a retry. Do not start another review with a new operation ID just because a response was interrupted. Check the operation status first.

```js
import { randomUUID } from 'node:crypto';
import { startMeteredVideoReview, decideMeteredVideoReview } from './metered-workflow.mjs';

const operationId = randomUUID();
const key = process.env.RENDER_CHECK_KEY; // private secret, never hard-code
const review = await startMeteredVideoReview({
  falResult, operationId, key,
  brief: {
    take: 'scene-03-take-02',
    brief: 'Keep the deflector centered behind the car.',
    requirements: [{ id: 'axis', description: 'Deflector is centered behind the car.' }],
    previousAttempts: [], historyComplete: false,
    editableAssets: ['existing centered take'], timestamps: [1.5]
  }
});
// A vision-capable agent examines review.frames and supplies its real observation.
const observations = [/* { id, observation, optional edit or retry } */];
const decision = await decideMeteredVideoReview({ review, observations, key });
```

Use the exact sampled timestamps and only list assets actually available. The adapter handles existing fal results or direct HTTPS video URLs. It never requests a new render.

