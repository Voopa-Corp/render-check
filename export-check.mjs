import { execFile } from 'node:child_process';
import { openIntakeVideo } from './intake-video.mjs';
import { promisify } from 'node:util';

const probe = promisify(execFile);
export async function readVideoMetadata({ path, format }) {
  const { stdout } = await probe('ffprobe', [
    '-v', 'error', '-protocol_whitelist', 'file', '-f', format, '-select_streams', 'v',
    '-show_entries', 'stream=width,height:stream_disposition=attached_pic:stream_side_data=rotation:format=duration',
    '-of', 'json', path,
  ], { timeout: 10_000, maxBuffer: 64_000 });
  const metadata = JSON.parse(stdout);
  const video = metadata.streams?.find((stream) => !stream.disposition?.attached_pic);
  if (!video?.width || !video.height) throw new Error('No video stream with readable dimensions.');
  const rotation = video.side_data_list?.find((data) => Number.isFinite(data.rotation))?.rotation ?? 0;
  const rotated = Math.abs(rotation % 180) === 90;
  const width = rotated ? video.height : video.width;
  const height = rotated ? video.width : video.height;
  const actualOrientation = width === height ? 'square' : width > height ? 'landscape' : 'portrait';
  const durationSeconds = Number(metadata.format?.duration);
  return { width, height, orientation: actualOrientation, durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null };
}

export async function checkExport({ file, orientation, maxDurationSeconds }) {
  const evidence = await readVideoMetadata(await openIntakeVideo(file));
  const { orientation: actualOrientation, durationSeconds } = evidence;
  const issues = [];
  if (actualOrientation !== orientation) {
    issues.push(`Expected ${orientation}. The clip is ${actualOrientation}.`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    issues.push('The container does not report a usable duration.');
  } else if (durationSeconds > maxDurationSeconds) {
    issues.push(`The clip runs ${durationSeconds} s, above the ${maxDurationSeconds} s limit.`);
  }
  return {
    decision: issues.length ? 'review_export' : 'review_creative',
    paidRenderGuidance: 'defer_to_reviewer',
    evidence,
    issues,
    nextStep: issues.length
      ? 'Check whether trimming, reframing, or re-export can resolve the issue before paying to regenerate.'
      : 'The export meets the specified limits. Compare the content with the brief before approving the shot.',
    scope: 'Reads video container metadata for duration and display orientation. Creative intent requires separate review.',
  };
}
