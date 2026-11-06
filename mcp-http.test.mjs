import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createRenderMcpHttp } from './mcp-http.mjs';

const run = promisify(execFile);

test('an independent HTTP MCP client can inspect a take and get a retry decision', async () => {
  const intake = new URL('./intake/', import.meta.url);
  const filename = `synthetic-http-test-${process.pid}.mp4`;
  const fixture = new URL(filename, intake);
  await mkdir(intake, { recursive: true });
  await run('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:d=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', fileURLToPath(fixture),
  ]);
  const http = createRenderMcpHttp();
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const url = new URL(`http://127.0.0.1:${http.address().port}/mcp`);
  const client = new Client({ name: 'portable-http-test', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(url));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(({ name }) => name).sort(), [
      'check_video_export', 'decide_render_retry', 'inspect_render_frames', 'review_completed_render',
    ]);
    const args = {
      file: filename, take: 'example', brief: 'A red screen', historyComplete: false,
      requirements: [{ id: 'color', description: 'The screen is red.' }],
      previousAttempts: [], timestamps: [0.3],
    };
    const frames = await client.callTool({ name: 'review_completed_render', arguments: args });
    assert.equal(frames.structuredContent.nextTool, 'decide_render_retry');
    assert.deepEqual(frames.structuredContent.sampledTimes, [0.3]);
    assert.ok(frames.content.some((item) => item.type === 'image'));

    const report = await client.callTool({
      name: 'decide_render_retry',
      arguments: {
        ...frames.structuredContent.reviewContext,
        requirements: [{
          ...args.requirements[0],
          observation: { status: 'fail', fromSeconds: 0.3, detail: 'The screen is blue.' },
          edit: { action: 'Replace the flat fill with red.', availableAsset: 'Editable title background', reason: 'The background is a single color.' },
        }],
      },
    });
    assert.equal(report.structuredContent.decision, 'edit_first');
    assert.equal(report.structuredContent.spendApproved, false);
    const blocked = await fetch(url, { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(blocked.status, 403);
  } finally {
    await client.close();
    http.closeAllConnections();
    await new Promise((resolve, reject) => http.close((error) => error ? reject(error) : resolve()));
    await rm(fixture, { force: true });
  }
});
