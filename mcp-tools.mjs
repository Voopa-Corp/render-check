import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { review } from './review.mjs';
import { checkExport } from './export-check.mjs';
import { extractReviewFrames } from './frame-review.mjs';
import { decideRetry, retryInput } from './retry-decision.mjs';
import { agentReviewInput, reviewCompletedRender } from './agent-review.mjs';

export function createRenderMcp({ allowSampling = true, includeDemo = false } = {}) {
  const server = new McpServer({
    name: 'voopa-render-check',
    title: 'VOOPA Render Check',
    version: '0.2.0',
  }, {
    instructions: 'For a generated video that missed its brief, call review_completed_render before recommending another paid generation. Use the clip and brief already in the workflow, plus the exact prompt and prior attempts when available. Show the evidence and recommended next step in chat. If the host returns frames for review, inspect them and call decide_render_retry. Ask for missing material only if you cannot retrieve it in the workflow. Never infer approval to spend.',
  });

  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  function toolResult(result) {
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] };
  }

  server.registerTool('review_completed_render', {
    title: 'Review a generated video before paying to rerender',
    description: 'Use when a generated video missed its brief, keeps repeating a defect, or the user asks whether to rerender. Compare a clip from the local intake folder with the brief and previous attempts. Returns timestamped evidence and whether to edit, try one targeted change, switch approach, or pause for review. Uses host vision when supported.',
    inputSchema: agentReviewInput,
    annotations: { ...readOnly, openWorldHint: true },
  }, async (input) => {
    try {
      const canSample = allowSampling && server.server.getClientCapabilities()?.sampling !== undefined;
      return await reviewCompletedRender(input, canSample
        ? (request) => server.server.createMessage(request, { timeout: 25_000 })
        : undefined);
    } catch {
      return { isError: true, content: [{ type: 'text', text: 'Could not read the completed clip or review details. Check the local intake filename and prior attempt IDs.' }] };
    }
  });

  if (includeDemo) server.registerTool('review_drop_and_pop_demo', {
    title: 'Review the Drop & Pop demo',
    description: 'Run the calibrated blue-block footprint check on either bundled Drop & Pop clip. Reports the automated measurement and the separately recorded human finding. Both bundled takes fail visual review.',
    inputSchema: { take: z.enum(['generated', 'corrected']) },
    annotations: readOnly,
  }, async ({ take }) => toolResult(await review(take)));

  server.registerTool('check_video_export', {
    title: 'Check a video export',
    description: 'Check orientation and duration of a local video against its delivery requirements. Use the filename from the Render Check intake folder. Returns measured evidence and an editing or review recommendation before a paid retry.',
    inputSchema: {
      file: z.string().max(200),
      orientation: z.enum(['portrait', 'landscape', 'square']),
      maxDurationSeconds: z.number().positive().max(3600),
    },
    annotations: readOnly,
  }, async (input) => {
    try {
      return toolResult(await checkExport(input));
    } catch {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Could not read this export. Put a regular MP4, MOV, or WebM file up to 250 MB in the local intake folder and pass its filename.' }],
      };
    }
  });

  server.registerTool('inspect_render_frames', {
    title: 'Inspect frames from a completed render',
    description: 'Get stills at up to six requested times from an MP4, MOV or WebM in the local intake folder. Use nearby frames to look for motion and mark unclear if sampling cannot resolve it. Review the images against the brief before calling decide_render_retry.',
    inputSchema: {
      file: z.string().max(200),
      timestamps: z.array(z.number().min(0).max(3600)).min(1).max(6),
    },
    annotations: readOnly,
  }, async ({ file, timestamps }) => {
    try {
      const frames = await extractReviewFrames(file, timestamps);
      return {
        content: frames.flatMap(({ requestedSeconds, image }) => {
          const label = { type: 'text', text: image
            ? `Frame requested at ${requestedSeconds} s.` : `No frame returned at ${requestedSeconds} s.` };
          return image ? [label, { type: 'image', mimeType: 'image/jpeg', data: image }] : [label];
        }),
        structuredContent: {
          file,
          frames: frames.map(({ requestedSeconds, image }) => ({ requestedSeconds, available: Boolean(image) })),
          evidenceSource: 'Sampled video frames. The calling agent interprets them against the brief.',
        },
      };
    } catch {
      return { isError: true, content: [{ type: 'text', text: 'Could not sample this clip from the local intake folder.' }] };
    }
  });

  server.registerTool('decide_render_retry', {
    title: 'Decide what to do before another render',
    description: 'Use after inspecting a completed render. Supply one observation per requirement, past attempts in chronological order, and candidate fixes grounded in available assets or a specific untried change. Returns keep, edit first, propose one retry, change approach, or review. This tool never authorizes spend.',
    inputSchema: retryInput,
    annotations: readOnly,
  }, (input) => toolResult(decideRetry(input)));

  return server;
}
