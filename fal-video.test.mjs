import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { withFalVideo } from './fal-video.mjs';

const url = 'https://v3b.fal.media/files/b/job/result.mp4';

test('fal intake only fetches a direct video and removes the temporary copy', async () => {
  let fetched = 0;
  let path;
  const download = async (request, options) => {
    fetched++;
    assert.equal(request.href, url);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    return new Response('fixture', { headers: { 'Content-Type': 'video/mp4' } });
  };
  for (const unsafe of ['https://v3b.fal.media.evil.test/files/job/video.mp4', 'http://v3b.fal.media/files/job/video.mp4', 'https://v3b.fal.media/files/job/text.html']) {
    await assert.rejects(withFalVideo(unsafe, assert.fail, download), /direct HTTPS/);
  }
  assert.equal(fetched, 0);

  assert.equal(await withFalVideo(url, async (video) => {
    path = video.path;
    assert.equal(video.format, 'mov');
    return readFile(path, 'utf8');
  }, download), 'fixture');
  await assert.rejects(stat(path), { code: 'ENOENT' });

  await assert.rejects(withFalVideo(url, async (video) => {
    path = video.path;
    throw new Error('decode failed');
  }, download), /decode failed/);
  await assert.rejects(stat(path), { code: 'ENOENT' });
  await assert.rejects(withFalVideo(url, assert.fail, async () => new Response('oversize', {
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': '100000001' },
  })), /outside the supported video limits/);
});
