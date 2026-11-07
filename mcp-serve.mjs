import { resolve } from 'node:path';
import { createRenderMcpHttp } from './mcp-http.mjs';

const publicHost = process.env.RENDER_EXTERNAL_HOSTNAME;
const port = Number(process.env.PORT ?? process.env.RENDER_CHECK_MCP_PORT ?? 50951);
const origin = publicHost ? `https://${publicHost}` : `http://127.0.0.1:${port}`;
let billing;
const mode = process.env.RENDER_CHECK_BILLING_MODE;
if (mode) {
  const live = mode === 'live';
  if (!['live', 'test'].includes(mode)) throw new Error('Billing mode must be test or live.');
  const file = process.env.RENDER_CHECK_BILLING_DB;
  const d1 = process.env.RENDER_CHECK_D1_ENDPOINT;
  if ((!d1 && !file) || (live && (!publicHost || (!d1 && (!resolve(file).startsWith('/var/data/') || process.env.RENDER_CHECK_DURABLE_STORAGE !== '1'))))) {
    throw new Error('Live billing requires HTTPS and a durable storage.');
  }
  const ledger = d1
    ? (await import('./credit-ledger-d1.mjs')).openD1CreditLedger({
      endpoint: d1, token: process.env.RENDER_CHECK_D1_TOKEN,
    })
    : (await import('./credit-ledger.mjs')).openCreditLedger(file);
  const { createStripeCheckout } = await import('./stripe-checkout.mjs');
  const { createBillingHttp } = await import('./billing-http.mjs');
  billing = createBillingHttp({
    stripe: createStripeCheckout({
      secretKey: process.env.RENDER_CHECK_STRIPE_KEY,
      webhookSecret: process.env.RENDER_CHECK_STRIPE_WEBHOOK,
      publicUrl: origin,
      live,
    }),
    ledger,
    live,
  });
}

createRenderMcpHttp({ publicHost, billing, checkoutUrl: origin + '/credits' }).listen(port, publicHost ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(publicHost ? `VOOPA Render Check MCP on port ${port}` : `VOOPA Render Check MCP at ${origin}/mcp`);
});
