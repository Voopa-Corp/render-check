import { lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const intake = new URL('./intake/', import.meta.url);

export async function openIntakeVideo(file) {
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*\.(mp4|mov|webm)$/i.test(file)) {
    throw new Error('Use an MP4, MOV, or WebM filename from the local intake folder.');
  }
  const path = fileURLToPath(new URL(encodeURIComponent(file), intake));
  const entry = await lstat(path);
  if (!entry.isFile() || entry.size > 250_000_000) {
    throw new Error('Use a regular video file up to 250 MB.');
  }
  return { path, format: file.toLowerCase().endsWith('.webm') ? 'matroska' : 'mov' };
}
