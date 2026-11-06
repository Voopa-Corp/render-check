import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const allowedHosts = new Set(['fal.media', 'v3.fal.media', 'v3b.fal.media']);
const maxBytes = 100_000_000;
const formats = { mp4: 'mov', mov: 'mov', webm: 'matroska' };
const contentTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'application/octet-stream']);

export async function withFalVideo(rawUrl, inspect, download = fetch) {
  const url = new URL(rawUrl);
  const extension = /^\/files\/(?:[\w.-]+\/)+[\w.-]+\.(mp4|mov|webm)$/i.exec(url.pathname)?.[1].toLowerCase();
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.port
    || url.username || url.password || url.hash || !extension) {
    throw new Error('Expected a direct HTTPS video result from fal.');
  }
  const response = await download(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'video/mp4, video/quicktime, video/webm, application/octet-stream' },
  });
  const length = Number(response.headers.get('content-length'));
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!response.ok || !response.body || !contentTypes.has(type) || length > maxBytes) {
    await response.body?.cancel();
    throw new Error('The fal result is unavailable or outside the supported video limits.');
  }
  const directory = await mkdtemp(join(tmpdir(), 'voopa-render-'));
  const path = join(directory, 'clip.' + extension);
  try {
    let bytes = 0;
    await pipeline(response.body, async function* (chunks) {
      for await (const chunk of chunks) {
        bytes += chunk.length;
        if (bytes > maxBytes) throw new Error('The fal result exceeds the video size limit.');
        yield chunk;
      }
    }, createWriteStream(path, { mode: 0o600, flags: 'wx' }));
    return await inspect({ path, format: formats[extension] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
