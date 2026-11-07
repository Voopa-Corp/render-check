import { readFile } from 'node:fs/promises';
import { creditPack } from './stripe-checkout.mjs';

const checkoutAttempt = /^[0-9a-f-]{36}$/i;

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function body(req, limit = 100_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) throw new Error('Payload too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createBillingHttp({ ledger, stripe, live = false }) {
  const authenticate = (req) => {
    const header = req.headers.authorization;
    return typeof header === 'string' && header.startsWith('Bearer ') ? ledger.authenticate(header.slice(7)) : undefined;
  };

  async function handle(req, res) {
    const path = req.url.split('?')[0];
    if (path === '/credits' && req.method === 'GET') {
      const page = await readFile(new URL('./credits.html', import.meta.url));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      }).end(page);
      return true;
    }
    if (path === '/credits.js' && req.method === 'GET') {
      const script = await readFile(new URL('./credits.js', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }).end(script);
      return true;
    }
    if (!path.startsWith('/billing/')) return false;
    if (path === '/billing/stripe-webhook' && req.method === 'POST') {
      let event;
      try {
        event = stripe.verify(await body(req), req.headers['stripe-signature']);
      } catch {
        json(res, 400, { error: 'Invalid Stripe event.' });
        return true;
      }
      try {
        if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
          const session = await stripe.readSession(event.data.object.id);
          await ledger.fulfill(session);
        } else if (event.type === 'charge.refunded') {
          const charge = event.data.object;
          if (charge.refunded && typeof charge.payment_intent === 'string' && charge.metadata?.render_check_order) {
            await ledger.refund(charge.payment_intent, charge.metadata.render_check_order);
          }
        }
      } catch {
        json(res, 503, { error: 'Please retry Stripe event delivery.' });
        return true;
      }
      json(res, 200, { received: true });
      return true;
    }
    if (path === '/billing/pack' && req.method === 'GET') {
      json(res, 200, { ...creditPack, live });
    } else if (path === '/billing/account' && req.method === 'POST' && req.headers['content-type'] === 'application/json') {
      json(res, 201, await ledger.createAccount());
    } else if (path === '/billing/balance' || path === '/billing/checkout') {
      const account = await authenticate(req);
      if (!account) {
        json(res, 401, { error: 'A valid Render Check account key is required.' });
      } else if (path === '/billing/balance' && req.method === 'GET') {
        json(res, 200, { balance: account.balance });
      } else if (path === '/billing/checkout' && req.method === 'POST' && req.headers['content-type'] === 'application/json') {
        let attempt;
        try {
          attempt = JSON.parse((await body(req, 4096)).toString('utf8')).attempt;
        } catch {
          json(res, 400, { error: 'Invalid checkout request.' });
          return true;
        }
        if (typeof attempt !== 'string' || !checkoutAttempt.test(attempt)) {
          json(res, 400, { error: 'Invalid checkout attempt.' });
          return true;
        }
        const order = await ledger.startOrder(account.id, attempt, creditPack);
        if (order.state !== 'pending') {
          json(res, 409, { error: 'This checkout has already been processed.' });
          return true;
        }
        try {
          const session = order.checkout_id ? await stripe.readSession(order.checkout_id) : await stripe.create(order);
          if (session.status !== 'open' || !session.url?.startsWith('https://checkout.stripe.com/')) {
            json(res, 409, { error: 'This checkout is closed. Start a new checkout.' });
            return true;
          }
          await ledger.attachCheckout(order.id, session.id);
          json(res, 200, { url: session.url });
        } catch {
          json(res, 503, { error: 'Checkout is temporarily unavailable. Try again.' });
        }
      } else {
        json(res, 405, { error: 'Method not allowed.' });
      }
    } else {
      json(res, 404, { error: 'Billing route not found.' });
    }
    return true;
  }

  return { handle, authenticate, ledger };
}
