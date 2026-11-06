import { existsSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRenderMcp } from './mcp-tools.mjs';

const includeDemo = existsSync(new URL('./media/generated.mp4', import.meta.url))
  && existsSync(new URL('./media/corrected.mp4', import.meta.url));
await createRenderMcp({ includeDemo }).connect(new StdioServerTransport());
