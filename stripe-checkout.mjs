import { createHmac, timingSafeEqual } from 'node:crypto';

export const creditPack = Object.freeze({ amount: 500, currency: 'usd', credits: 50 });

export function verifyStripeEvent(raw, signature, secret, now = Date.now()) {
  if (!signature) throw new Error('Missing Stripe signature.');
  const fields = signature.split(',').map((pair) => pair.trim().split('='));
  const time = fields.find(([key]) => key === 't')?.[1];
  if (!/^\d{1,15}$/.test(time ?? '') || Math.abs(now / 1000 - Number(time)) > 300) {
    throw new Error('Invalid Stripe signature timestamp.');
  }
  const expected = createHmac('sha256', secret).update(time + '.').update(raw).digest();
  const valid = fields.some(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value ?? '')
    && timingSafeEqual(expected, Buffer.from(value, 'hex')));
  if (!valid) throw new Error('Invalid Stripe signature.');
  return JSON.parse(raw.toString('utf8'));
}

export function createStripeCheckout({ secretKey, webhookSecret, publicUrl, live = false, download = fetch }) {
  const environment = live ? 'live' : 'test';
  if (!new RegExp('^(sk|rk)_' + environment + '_').test(secretKey ?? '') || !webhookSecret?.startsWith('whsec_')) {
    throw new Error('Stripe credentials must match the selected billing mode.');
  }
  const base = new URL(publicUrl);
  if ((live && base.protocol !== 'https:') || base.username || base.password) throw new Error('Invalid checkout return URL.');

  async function stripe(path, { body, idempotencyKey } = {}) {
    const headers = { Authorization: 'Bearer ' + secretKey };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await download('https://api.stripe.com/v1/' + path, {
      method: body ? 'POST' : 'GET', body, headers, redirect: 'error', signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('Stripe returned HTTP ' + response.status + '.');
    const result = await response.json();
    if (result.livemode !== live) throw new Error('Unexpected Stripe mode.');
    return result;
  }

  return {
    async create(order) {
      return stripe('checkout/sessions', {
        idempotencyKey: 'render-check:' + order.id,
        body: new URLSearchParams({
          mode: 'payment',
          'payment_method_types[0]': 'card',
          client_reference_id: order.id,
          'metadata[render_check_order]': order.id,
          'payment_intent_data[metadata][render_check_order]': order.id,
          'line_items[0][quantity]': '1',
          'line_items[0][price_data][currency]': order.currency,
          'line_items[0][price_data][unit_amount]': String(order.amount),
          'line_items[0][price_data][product_data][name]': 'VOOPA Render Check · ' + order.credits + ' review credits',
          success_url: new URL('/credits?checkout=complete', base).href,
          cancel_url: new URL('/credits?checkout=cancelled', base).href,
        }),
      });
    },
    verify(raw, signature) {
      const event = verifyStripeEvent(raw, signature, webhookSecret);
      if (event.livemode !== live) throw new Error('Wrong Stripe webhook mode.');
      return event;
    },
    async readSession(id) {
      if (!/^cs_(test|live)_[\w]+$/.test(id ?? '')) throw new Error('Invalid Stripe session.');
      return stripe('checkout/sessions/' + id);
    },
  };
}
