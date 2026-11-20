# Render Check for Replicate and ComfyUI

Add a check after a completed generation and before another paid attempt. These initial integrations call the free, rate-limited Render Check preview. They do not start a generation, verify the full brief, or automatically decide a creative result. The video check flags candidate black passages; the image check reports image export metadata. Review findings before acting.

## ComfyUI node

1. Copy the comfyui_render_check folder into your ComfyUI custom_nodes folder, install certifi in ComfyUI's Python environment, and restart ComfyUI. The [registry listing](https://registry.comfy.org/publishers/voopacorp/nodes/voopa-render-check) is public; both versions are flagged for their network call, and ComfyUI Manager availability is not confirmed.
2. Add VOOPA / Render Check / Render Check (public media URL) in the node menu.
3. Supply a direct public HTTPS URL and select video or image. Run the workflow. The node returns the URL and a JSON report as string outputs for a text-display or downstream node.

ComfyUI images and video files stored on your own machine are not automatically uploaded. Use a URL from a storage service you control, or an output URL already available from your renderer. Anyone with a public or bearer-style URL may be able to access that asset; share only material you have permission to send. The node transmits the URL to VOOPA Render Check for retrieval and processing. Expiring URLs must remain valid while the check runs. The node does not connect directly to a ComfyUI IMAGE tensor, modify the media, or automatically inspect every generated output.

On 19 November 2026, a CPU-only ComfyUI 0.46.0 test ran the node against the live preview and detected the deliberate 3–4 second gap in our sample. This is one functional check, not a validation of every creative flaw. The registry flags both versions for the network call to Render Check; ComfyUI Manager availability is not confirmed.

## Replicate post-processing

After a Replicate prediction succeeds, pipe its JSON response into the review command. In your existing workflow, the JSON can come from your Replicate SDK or a GET /v1/predictions/{id} call; do not expose your Replicate API token to this script.

    python3 integrations/replicate/review_prediction.py --type video < prediction.json

Use --type image for image outputs. The command accepts a succeeded prediction whose output is a direct HTTPS URL or a list of URLs (up to 10). For object-shaped outputs extract the intended URL first and pass it as output. Non-successful jobs are rejected and do not trigger a check. Replicate output links may expire: run promptly or use a URL you control. See [Replicate data retention](https://replicate.com/docs/topics/predictions/data-retention/).

This is an explicit post-processing step, not a hosted webhook or official Replicate integration. If you add a webhook, verify Replicate's signatures, protect it against retries and replay, and authenticate each customer before triggering chargeable work. Never put keys into a public workflow. See [Replicate webhook verification](https://replicate.com/docs/topics/webhooks/verify-webhook).

## Try it

    printf '%s' '{"status":"succeeded","output":"https://raw.githubusercontent.com/Voopa-Corp/render-check/main/black-gap-demo.mp4"}' | python3 integrations/replicate/review_prediction.py --type video

The demo has a deliberate black passage near 3–4 seconds. This simulates a successful prediction; it is not a real Replicate prediction. The service or rate limit may be unavailable, and a clear check does not certify an image or video.


## Runware and Luma post-processing

After a completed Runware task, pass its JSON response to `python3 integrations/review_provider.py --provider runware < response.json`. This reads completed imageURL and videoURL outputs; processing and error rows are skipped. For the Luma video API format documented [here](https://docs.lumalabs.ai/docs/python-video-generation), use `python3 integrations/review_provider.py --provider luma < response.json` after the generation reaches completed.

The scripts run the free rate-limited preview and do not generate media or assess the whole brief. They send the media URL to VOOPA for retrieval. Only share authorized assets. Eight automated tests passed. On 19 November 2026, the live black-gap check ran on a Runware guide video and a Luma Ray 3.2 video published in Runware’s guide. Both tests used constructed provider responses and did not call either provider API. No black passages were flagged. Creative review remains necessary. These are community adapters, not official provider integrations.
## Leonardo.Ai post-processing
After a generation completes, save the response from Leonardo’s Get a Single Generation API as response.json, then run:`python3 integrations/review_provider.py --provider leonardo < response.json`
The adapter accepts COMPLETE generations and checks the image URL, or motionMP4URL when present. It sends the URL to VOOPA’s free, rate-limited preview. A Leonardo-hosted image from Leonardo’s documentation was checked using a constructed response; an actual customer API response and video remain untested. This is a community adapter and is not a Leonardo listing or endorsement.
## Black Forest Labs and Runway
For a completed Black Forest Labs image result with status Ready, save the response as response.json and run `python3 integrations/review_provider.py --provider bfl < response.json`. The result URL is short-lived; use it promptly.
For a successful Runway VIDEO task response, run `python3 integrations/review_provider.py --provider runway < response.json`. Use this path only for video tasks; it checks for black gaps. Runway output links expire, so run promptly.
These are community adapters, not official integrations. Both were tested with constructed provider responses against the live preview; they do not generate media or assess the full creative brief.
## Connect to Luma Agents
In Luma, open Connectors, choose Add custom connector, name it VOOPA Render Check and enter `https://voopa-render-check.onrender.com/mcp`. Confirm the connection. Luma lists 18 tools on the connected server in our account. Luma can send the data its agent supplies to the connector to VOOPA; share only media and information you are authorized to process. The connection has been verified in our account; in a live test, Luma called the black-gap tool on our demo and identified the 3–4 second gap. Luma also called the image-export tool on a 640 × 357 preview of a Luma-generated image; it did not check the full-resolution image or creative content.
