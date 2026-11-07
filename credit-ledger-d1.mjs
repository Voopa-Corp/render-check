import { createHash, randomBytes, randomUUID } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export function openD1CreditLedger({ endpoint, token, download = fetch }) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.pathname !== '/query' || url.username || url.password || !token) {
    throw new Error('D1 billing storage credentials are incomplete.');
  }
  async function query(sql, ...params) {
    const response = await download(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (!response.ok) throw new Error('Credit storage is unavailable.');
    const result = await response.json();
    if (!result.success || !result.result?.[0]?.success) throw new Error('Credit storage query failed.');
    return result.result[0].results;
  }
  return {
    async createAccount() {
      const key = 'vrc_' + randomBytes(32).toString('base64url');
      await query('INSERT INTO credit_accounts(id, token_hash) VALUES (?, ?)', randomUUID(), hash(key));
      return { token: key, balance: 0 };
    },
    async authenticate(key) {
      if (!/^vrc_[\w-]{43}$/.test(key ?? '')) return undefined;
      return (await query('SELECT id, balance FROM credit_accounts WHERE token_hash = ?', hash(key)))[0];
    },
    async startOrder(id, attempt, pack) {
      await query(`INSERT INTO credit_orders(id, account_id, checkout_attempt, amount, currency, credits)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, checkout_attempt) DO NOTHING`,
      randomUUID(), id, attempt, pack.amount, pack.currency, pack.credits);
      return (await query('SELECT * FROM credit_orders WHERE account_id = ? AND checkout_attempt = ?', id, attempt))[0];
    },
    async attachCheckout(id, checkout) {
      const rows = await query(`UPDATE credit_orders SET checkout_id = ?
        WHERE id = ? AND (checkout_id IS NULL OR checkout_id = ?) RETURNING id`, checkout, id, checkout);
      if (!rows.length) throw new Error('Unexpected checkout for this order.');
    },
    async fulfill(session) {
      const id = session.client_reference_id;
      if (!id || session.metadata?.render_check_order !== id || session.payment_status !== 'paid'
        || session.status !== 'complete' || session.mode !== 'payment' || typeof session.payment_intent !== 'string') return false;
      const rows = await query(`UPDATE credit_orders SET checkout_id = ?, payment_intent = ?, state = 'paid'
        WHERE id = ? AND state = 'pending' AND amount = ? AND currency = ?
        AND (checkout_id IS NULL OR checkout_id = ?) RETURNING id`,
      session.id, session.payment_intent, id, session.amount_total, session.currency, session.id);
      return rows.length > 0;
    },
    async refund(intent, id) {
      const rows = await query(`UPDATE credit_orders SET payment_intent = ?, state = 'refunded'
        WHERE id = ? AND state != 'refunded' AND (payment_intent IS NULL OR payment_intent = ?) RETURNING id`,
      intent, id, intent);
      return rows.length > 0;
    },
    async useReview(id, review, payload) {
      const digest = hash(JSON.stringify(payload));
      const rows = await query(`INSERT INTO credit_reviews(account_id, review_id, payload_hash)
        SELECT id, ?, ? FROM credit_accounts WHERE id = ? AND balance > 0
        ON CONFLICT(account_id, review_id) DO NOTHING RETURNING review_id`, review, digest, id);
      const [state] = await query(`SELECT balance, payload_hash FROM credit_accounts
        LEFT JOIN credit_reviews ON account_id = id AND review_id = ? WHERE id = ?`, review, id);
      const status = rows.length ? 'charged' : !state?.payload_hash ? 'insufficient'
        : state.payload_hash === digest ? 'replayed' : 'conflict';
      return { status, balance: state?.balance ?? 0 };
    },
  };
}
