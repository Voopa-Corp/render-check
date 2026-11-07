import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export function openCreditLedger(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS credit_accounts (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS credit_orders (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES credit_accounts(id),
      checkout_attempt TEXT NOT NULL, checkout_id TEXT UNIQUE, payment_intent TEXT UNIQUE,
      amount INTEGER NOT NULL, currency TEXT NOT NULL, credits INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','paid','refunded')),
      UNIQUE(account_id, checkout_attempt)
    );
    CREATE TABLE IF NOT EXISTS credit_reviews (
      account_id TEXT NOT NULL REFERENCES credit_accounts(id), review_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL, PRIMARY KEY(account_id, review_id)
    );
  `);

  function transaction(run) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return {
    close: () => db.close(),
    createAccount() {
      const id = randomUUID();
      const token = 'vrc_' + randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO credit_accounts(id, token_hash) VALUES (?, ?)').run(id, hash(token));
      return { token, balance: 0 };
    },
    authenticate(token) {
      if (!/^vrc_[\w-]{43}$/.test(token ?? '')) return undefined;
      return db.prepare('SELECT id, balance FROM credit_accounts WHERE token_hash = ?').get(hash(token));
    },
    startOrder(accountId, attempt, pack) {
      db.prepare(`INSERT INTO credit_orders(id, account_id, checkout_attempt, amount, currency, credits)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, checkout_attempt) DO NOTHING`)
        .run(randomUUID(), accountId, attempt, pack.amount, pack.currency, pack.credits);
      return db.prepare('SELECT * FROM credit_orders WHERE account_id = ? AND checkout_attempt = ?').get(accountId, attempt);
    },
    attachCheckout(orderId, checkoutId) {
      const result = db.prepare(`UPDATE credit_orders SET checkout_id = ?
        WHERE id = ? AND (checkout_id IS NULL OR checkout_id = ?)`).run(checkoutId, orderId, checkoutId);
      if (!result.changes) throw new Error('Unexpected checkout for this order.');
    },
    fulfill(session) {
      return transaction(() => {
        const order = db.prepare('SELECT * FROM credit_orders WHERE id = ?').get(session.client_reference_id ?? '');
        if (!order || session.metadata?.render_check_order !== order.id) return false;
        if (session.payment_status !== 'paid' || session.status !== 'complete' || session.mode !== 'payment'
          || session.amount_total !== order.amount || session.currency !== order.currency
          || typeof session.payment_intent !== 'string' || (order.checkout_id && order.checkout_id !== session.id)) return false;
        if (order.state !== 'pending') return false;
        db.prepare("UPDATE credit_orders SET checkout_id = ?, payment_intent = ?, state = 'paid' WHERE id = ?")
          .run(session.id, session.payment_intent, order.id);
        db.prepare('UPDATE credit_accounts SET balance = balance + ? WHERE id = ?').run(order.credits, order.account_id);
        return true;
      });
    },
    refund(intent, orderId) {
      return transaction(() => {
        const order = db.prepare('SELECT * FROM credit_orders WHERE id = ?').get(orderId);
        if (!order || order.state === 'refunded' || (order.payment_intent && order.payment_intent !== intent)) return false;
        db.prepare("UPDATE credit_orders SET payment_intent = ?, state = 'refunded' WHERE id = ?").run(intent, order.id);
        if (order.state === 'paid') {
          db.prepare('UPDATE credit_accounts SET balance = balance - ? WHERE id = ?').run(order.credits, order.account_id);
        }
        return true;
      });
    },
    useReview(accountId, reviewId, payload) {
      const digest = hash(JSON.stringify(payload));
      return transaction(() => {
        const existing = db.prepare('SELECT payload_hash FROM credit_reviews WHERE account_id = ? AND review_id = ?').get(accountId, reviewId);
        const account = db.prepare('SELECT balance FROM credit_accounts WHERE id = ?').get(accountId);
        if (existing) return {
          status: existing.payload_hash === digest ? 'replayed' : 'conflict', balance: account.balance,
        };
        if (account.balance <= 0) return { status: 'insufficient', balance: account.balance };
        db.prepare('INSERT INTO credit_reviews(account_id, review_id, payload_hash) VALUES (?, ?, ?)').run(accountId, reviewId, digest);
        db.prepare('UPDATE credit_accounts SET balance = balance - 1 WHERE id = ?').run(accountId);
        return { status: 'charged', balance: account.balance - 1 };
      });
    },
  };
}
