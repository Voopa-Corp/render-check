# Try the repeated-shot scanner

This small synthetic example repeats the same three-second moving sequence after a three-second blue segment. It is generated from FFmpeg's test patterns; it contains no personal footage or soundtrack.

Connect an MCP-capable agent to `https://voopa-render-check.onrender.com/mcp` and ask it to call `scan_repeated_shots` with:

```json
{"renderVideoUrl":"https://raw.githubusercontent.com/Voopa-Corp/render-check/main/repeated-shot-demo.mp4"}
```

In the local test the scanner suggested comparing the two-second passages starting at approximately 0 and 6 seconds. View both segments before judging whether the repeat is unwanted. This is a controlled illustration, not a benchmark or a claim that the scanner finds every repeat. Its results depend on the material; a similar scene can be intentional. The scan does not assess audio, lip synchronization, or creative intent and never authorizes a paid retry.

Long videos can be checked in selected portions of up to 60 seconds using `fromSeconds` and `durationSeconds`. Matches between separate portions can be missed. The service downloads the supplied URL to process the video; only submit material you are entitled to share with the service.
