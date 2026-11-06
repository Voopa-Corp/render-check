import { createRenderMcpHttp } from './mcp-http.mjs';

const port = Number(process.env.RENDER_CHECK_MCP_PORT ?? 50951);
createRenderMcpHttp().listen(port, '127.0.0.1', () => {
  console.log(`VOOPA Render Check MCP at http://127.0.0.1:${port}/mcp`);
});
