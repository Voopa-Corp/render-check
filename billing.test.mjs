import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { openD1CreditLedger } from './credit-ledger-d1.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { openCreditLedger } from './credit-ledger.mjs';
import { createBillingHttp } from './billing-http.mjs';
import { createRenderMcpHttp } from './mcp-http.mjs';
import { createStripeCheckout } from './stripe-checkout.mjs';

for (const storage of ['SQLite', 'D1']) {
test(`Checkout and MCP debit are idempotent with ${storage}`, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'vrc-billing-test-'));
  const path = join(temp, 'credits.sqlite');
  let database;
  const open = () => storage === 'SQLite' ? openCreditLedger(path) : openD1CreditLedger({
    endpoint: 'https://credits.invalid/query', token: 'fixture',
    async download(_url, options) {
      const { sql, params } = JSON.parse(options.body);
      const results = database.prepare(sql).all(...params);
      return Response.json({ success: true, result: [{ success: true, results }] });
    },
  });
  if (storage === 'D1') {
    database = new DatabaseSync(path);
    database.exec(await readFile(new URL('./credit-ledger-d1.sql', import.meta.url), 'utf8'));
  }
  const ledger = open();
  const secret = 'whsec_local_fixture';
  let checkout;
  let creates = 0;
  const stripe = createStripeCheckout({
    secretKey: 'sk_test_local_fixture', webhookSecret: secret, publicUrl: 'http://localhost:50951',
    async download(url, options) {
      if (options.method === 'POST') {
        creates++;
        const data = options.body;
        assert.equal(data.get('line_items[0][price_data][unit_amount]'), '500');
        assert.equal(data.get('mode'), 'payment');
        assert.match(options.headers['Idempotency-Key'], /^render-check:/);
        const order = data.get('client_reference_id');
        checkout = {
          id: 'cs_test_fixture', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_fixture',
          client_reference_id: order, metadata: { render_check_order: order },
          payment_status: 'unpaid', status: 'open', mode: 'payment', amount_total: 500, currency: 'usd',
          payment_intent: 'pi_test_fixture',
        };
      } else {
        assert.match(url, /cs_test_fixture$/);
      }
      return Response.json(checkout);
    },
  });
  const http = createRenderMcpHttp({
    billing: createBillingHttp({ ledger, stripe }), checkoutUrl: 'http://localhost:50951/credits',
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const origin = `http://127.0.0.1:${http.address().port}`;
  let token;
  const post = (route, value, headers = {}) => fetch(origin + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  const balance = async () => (await (await fetch(origin + '/billing/balance', {
    headers: { Authorization: 'Bearer ' + token },
  })).json()).balance;
  const event = (type, object) => JSON.stringify({ type, livemode: false, data: { object } });
  const signed = (raw) => {
    const time = Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', secret).update(time + '.' + raw).digest('hex');
    return post('/billing/stripe-webhook', raw, { 'Stripe-Signature': `t=${time},v1=${digest}` });
  };
  const client = new Client({ name: 'billing-test', version: '1.0.0' });
  try {
    assert.equal((await fetch(origin + '/credits')).status, 200);
    assert.equal((await fetch(origin + '/mcp/paid')).status, 401);
    const created = await post('/billing/account', {});
    assert.equal(created.status, 201);
    ({ token } = await created.json());
    assert.equal(await balance(), 0);
    const attempt = randomUUID();
    assert.equal((await post('/billing/checkout', { attempt })).status, 200);
    assert.equal((await post('/billing/checkout', { attempt })).status, 200);
    assert.equal(creates, 1);
    const paidEvent = event('checkout.session.completed', { id: checkout.id });
    assert.equal((await post('/billing/stripe-webhook', paidEvent)).status, 400);
    assert.equal((await signed(paidEvent)).status, 200);
    assert.equal(await balance(), 0);
    checkout.status = 'complete';
    checkout.payment_status = 'paid';
    await Promise.all([signed(paidEvent), signed(paidEvent)]);
    assert.equal(await balance(), 50);

    await client.connect(new StreamableHTTPClientTransport(new URL(origin + '/mcp/paid'), {
      requestInit: { headers: { Authorization: 'Bearer ' + token } },
    }));
    const args = {
      take: 'example', brief: 'A red screen', historyComplete: false, previousAttempts: [],
      requirements: [{ id: 'color', description: 'The screen is red.' }],
      reviewId: 'test-review-1',
    };
    const decide = (arguments_) => client.callTool({ name: 'decide_render_retry', arguments: arguments_ });
    assert.equal((await decide(args)).structuredContent.decision, 'review');
    assert.equal(await balance(), 50);
    args.requirements[0].observation = { status: 'pass', fromSeconds: 0, detail: 'The screen is red.' };
    const [first, duplicate] = await Promise.all([decide(args), decide(args)]);
    assert.equal(first.structuredContent.creditsUsed + duplicate.structuredContent.creditsUsed, 1);
    assert.equal(await balance(), 49);
    assert.equal((await decide({ ...args, take: 'different' })).isError, true);
    assert.equal(await balance(), 49);
    if (database) {
      database.close();
      database = new DatabaseSync(path);
    }
    const reopened = open();
    assert.equal((await reopened.authenticate(token)).balance, 49);
    reopened.close?.();

    const refund = event('charge.refunded', {
      refunded: true, payment_intent: checkout.payment_intent, metadata: checkout.metadata,
    });
    assert.equal((await signed(refund)).status, 200);
    assert.equal((await signed(refund)).status, 200);
    assert.equal(await balance(), -1);
    assert.equal((await decide({ ...args, reviewId: 'new-review-2' })).structuredContent.decision, 'credit_required');
  } finally {
    await client.close();
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
    ledger.close?.();
    database?.close();
    await rm(temp, { recursive: true, force: true });
  }
});
}
