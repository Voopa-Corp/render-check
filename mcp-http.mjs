import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createRenderMcp } from './mcp-tools.mjs';

function rpcError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

export function createRenderMcpHttp({ publicHost, maxReviewsPerMinute = 6, maxReviewsPerDay = 24, billing, checkoutUrl } = {}) {
  const hosted = Boolean(publicHost);
  let activeReviews = 0;
  let recentReviews = [];
  const http = createServer(async (req, res) => {
    const port = http.address().port;
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (hosted) allowedHosts.push(publicHost);
    if (!allowedHosts.includes(req.headers.host)
      || (req.headers.origin && !allowedHosts.some((host) => req.headers.origin === `${host === publicHost ? 'https' : 'http'}://${host}`))) {
      return rpcError(res, 403, 'Host or origin is not allowed.');
    }
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok","service":"voopa-render-check"}');
      return;
    }
    try {
      if (billing && await billing.handle(req, res)) return;
    } catch {
      return rpcError(res, 503, 'Billing is temporarily unavailable.');
    }
    const paid = Boolean(billing && req.url === '/mcp/paid');
    if (!paid && req.url !== '/mcp') return rpcError(res, 404, 'Use /mcp.');
    let paidAccount;
    try {
      if (paid) paidAccount = await billing.authenticate(req);
    } catch {
      return rpcError(res, 503, 'Billing is temporarily unavailable.');
    }
    if (paid && !paidAccount) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return rpcError(res, 401, 'A valid Render Check account key is required.');
    }
    const server = createRenderMcp({
      allowSampling: false, hosted: hosted || paid, paidAccount, creditLedger: billing?.ledger, checkoutUrl,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.once('close', () => { void server.close(); });
    let reserved = false;
    try {
      let body;
      if ((hosted || paid) && req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
          return rpcError(res, 415, 'Use application/json.');
        }
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          bytes += chunk.length;
          if (bytes > 100_000) {
            res.setHeader('Connection', 'close');
            return rpcError(res, 413, 'Request exceeds the preview size limit.');
          }
          chunks.push(chunk);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          return rpcError(res, 400, 'Invalid JSON.');
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return rpcError(res, 400, 'Send one MCP message per request.');
        }
        if (body.method === 'tools/call' && body.params?.name === 'review_completed_render') {
          const now = Date.now();
          recentReviews = recentReviews.filter((time) => time > now - 86_400_000);
          if (!paid && recentReviews.length >= maxReviewsPerDay) {
            res.setHeader('Retry-After', String(Math.ceil((recentReviews[0] + 86_400_000 - now) / 1000)));
            return rpcError(res, 429, 'The free preview has reached its daily review limit.');
          }
          if (activeReviews >= 2 || (!paid && recentReviews.filter((time) => time > now - 60_000).length >= maxReviewsPerMinute)) {
            res.setHeader('Retry-After', '60');
            return rpcError(res, 429, 'The free preview is busy. Try again in a minute.');
          }
          if (!paid) recentReviews.push(now);
          activeReviews++;
          reserved = true;
        }
      }
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      if (!res.headersSent) rpcError(res, 500, 'Could not complete the MCP request.');
      else if (!res.writableEnded) res.destroy();
    } finally {
      if (reserved) activeReviews--;
    }
  });
  return http;
}
