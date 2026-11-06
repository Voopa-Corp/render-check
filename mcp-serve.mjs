import { createRenderMcpHttp } from './mcp-http.mjs';

const publicHost = process.env.RENDER_EXTERNAL_HOSTNAME;
const port = Number(process.env.PORT ?? process.env.RENDER_CHECK_MCP_PORT ?? 50951);
createRenderMcpHttp({ publicHost }).listen(port, publicHost ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(publicHost ? `VOOPA Render Check MCP on port ${port}` : `VOOPA Render Check MCP at http://127.0.0.1:${port}/mcp`);
});
