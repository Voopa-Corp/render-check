import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createRenderMcp } from './mcp-tools.mjs';

export function createRenderMcpHttp() {
  const http = createServer(async (req, res) => {
    const port = http.address().port;
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowedHosts.includes(req.headers.host)
      || (req.headers.origin && !allowedHosts.some((host) => req.headers.origin === `http://${host}`))) {
      res.writeHead(403).end();
      return;
    }
    if (req.url !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    const server = createRenderMcp({ allowSampling: false });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.once('close', () => { void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500).end();
      else if (!res.writableEnded) res.destroy();
    }
  });
  return http;
}
