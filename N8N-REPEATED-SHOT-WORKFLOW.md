# Try repeated-shot review in n8n

Import [`render-check-repeat-scan-n8n.json`](render-check-repeat-scan-n8n.json) into your n8n instance. It is inactive by default. Run **Try the demo** to scan a small, synthetic video with one deliberately repeated shot. The expected result is a review candidate at approximately 0 and 6 seconds. This is a controlled demonstration, not a performance benchmark.

To use it inside another workflow, call it as a sub-workflow and pass a direct HTTPS `renderVideoUrl`. Optionally pass `fromSeconds` and `durationSeconds` to select a 4–60 second portion. Only share media you are entitled to send to Render Check. The service downloads the clip temporarily for analysis.

The returned data contains the examined range, possible moving and low-motion matches, and limitations. A person or capable agent must review the suggestions. An empty result does not mean the video has no repeats; matches can also be intentional. The scan does not check audio, lip synchronization or creative intent and does not authorize another paid render. The free hosted preview is rate limited and may take time to wake up.

The template's request and response handling have been checked locally against the live service. Import and execution inside a separate n8n instance have not yet been verified.
