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

CREATE TRIGGER IF NOT EXISTS credit_order_paid AFTER UPDATE OF state ON credit_orders
WHEN OLD.state = 'pending' AND NEW.state = 'paid'
BEGIN
  UPDATE credit_accounts SET balance = balance + NEW.credits WHERE id = NEW.account_id;
END;
CREATE TRIGGER IF NOT EXISTS credit_order_refunded AFTER UPDATE OF state ON credit_orders
WHEN OLD.state = 'paid' AND NEW.state = 'refunded'
BEGIN
  UPDATE credit_accounts SET balance = balance - NEW.credits WHERE id = NEW.account_id;
END;
CREATE TRIGGER IF NOT EXISTS credit_review_debit AFTER INSERT ON credit_reviews
BEGIN
  UPDATE credit_accounts SET balance = balance - 1 WHERE id = NEW.account_id;
END;
