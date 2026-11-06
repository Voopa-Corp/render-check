import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openIntakeVideo } from './intake-video.mjs';

const run = promisify(execFile);

export async function extractReviewFrames(file, timestamps) {
  return extractFrames(await openIntakeVideo(file), timestamps);
}

export async function extractFrames({ path, format }, timestamps) {
  const frames = [];
  for (const seconds of timestamps) {
    const { stdout } = await run('ffmpeg', [
      '-v', 'error', '-protocol_whitelist', 'file', '-f', format,
      '-ss', seconds.toFixed(3), '-i', path, '-map', '0:V:0',
      '-frames:v', '1', '-an', '-vf', 'scale=960:960:force_original_aspect_ratio=decrease',
      '-c:v', 'mjpeg', '-threads', '1', '-q:v', '3', '-f', 'image2pipe', '-',
    ], { encoding: 'buffer', maxBuffer: 1_500_000, timeout: 5_000 });
    frames.push({ requestedSeconds: seconds, image: stdout.length ? stdout.toString('base64') : null });
  }
  return frames;
}
