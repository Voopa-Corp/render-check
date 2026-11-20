# Try the short audio-gap check

This public test uses synthetic test-pattern video and a tone, with approximately 0.2 seconds of silence deliberately inserted around 1.5 seconds. No private footage, API key or paid generation is needed. Render Check's hosted preview is free and rate-limited.

Call `review_completed_render` on `https://voopa-render-check.onrender.com/mcp` with:

```json
{
  "renderVideoUrl": "https://raw.githubusercontent.com/Voopa-Corp/render-check/main/audio-gap-demo.mp4",
  "take": "Short audio dropout demo",
  "brief": "The tone should play continuously.",
  "requirements": [{ "id": "sound", "description": "The tone is audible throughout." }],
  "previousAttempts": [],
  "historyComplete": false,
  "expectedAudio": { "fromSeconds": 1.2, "toSeconds": 2.0, "minimumGapSeconds": 0.1 }
}
```

Expected: `inspect_audio_before_retry`, with an `unexpected_silence` candidate near 1.5–1.7 seconds and `spendApproved: false`. Exact times depend on encoding. With the default 0.35-second minimum, this short dropout is below the detection threshold. The result is evidence for a reviewer, not permission to rerender.

A low level or intentional pause can also be flagged. This check does not verify lip sync, the identity of a soundtrack, lyrics, audio quality, or the entire video. Inspect and listen to the relevant interval. Use only media you have permission to share; the hosted preview needs a reachable direct HTTPS URL or a supported attachment.
