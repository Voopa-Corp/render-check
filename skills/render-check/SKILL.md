---
name: render-check
description: Review an existing AI-generated video or image against its brief with VOOPA Render Check before recommending a paid retry. Use when a generated take is wrong, continuity drifts, or the user asks whether to rerender.
---

# Render Check

Use the Render Check MCP server after a completed image or video misses its brief, before proposing another paid take. Connect its Streamable HTTP endpoint at `https://voopa-render-check.onrender.com/mcp`. Setup: https://github.com/Voopa-Corp/render-check#add-render-check-to-your-agent. The free preview is rate limited.

1. Reuse the existing image or video, the brief, original prompt, attempt history and any available alternative takes. Do not generate a new clip merely to test it.
2. Call `review_completed_render` for video or `review_completed_image` for images. Supply the specific requirements and timestamps if known. Use `historyComplete: false` if the prior attempts are unknown.
3. If the response returns frames or an image for review, inspect the visual evidence yourself against the requirements. Call `decide_render_retry` with observations grounded in the returned evidence and the actual available assets. Do not claim sampled frames prove continuous motion, speaker identity or lip sync.
4. Report the relevant timestamp, the discrepancy and a practical next action: keep, edit an existing take, propose one targeted retry, change approach or review further. Do not claim the tool approved spending or guarantees a better next generation.
5. Treat the next render's price as unknown unless the user or provider explicitly gives a per-retry quote. A total previously spent, account balance, or project budget is not the cost of the next render. Include the quote and its source only when explicitly known; otherwise do not estimate a dollar saving.

For paid metered workflows use the documented `/mcp/usage` route: estimate the charge, start `review_metered_video` or `review_metered_image` with a unique operation ID, and use the same ID with `decide_metered_retry`. Check operation status before retrying an interrupted call to avoid duplicate charges. Full guide: https://github.com/Voopa-Corp/render-check/blob/main/AGENT-BILLING.md.

Send only media the user authorizes the service to inspect. Never disclose credentials in a prompt or URL.
