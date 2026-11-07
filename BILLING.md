# VOOPA Render Check billing

The proposed launch pack is 50 completed reviews for $5 USD through Stripe Checkout. Credits are attached to a customer’s private Render Check key. The agent gets a credit-required response and a checkout page when the balance runs out. It can use an existing balance but cannot create a purchase. Use a stable review ID for transport retries so a completed review is debited only once.

## Test and operate

- Run the test suite with Node.js 22.13 or later and FFmpeg. The billing test exercises the checkout, signed Stripe webhook, durable SQLite ledger, paid MCP endpoint, duplicate delivery, and full refund behavior.
- The hosted preview starts without billing by default. Set `RENDER_CHECK_BILLING_MODE=test`, `RENDER_CHECK_BILLING_DB` to a local file, and provide sandbox credentials through `RENDER_CHECK_STRIPE_KEY` and `RENDER_CHECK_STRIPE_WEBHOOK`. Then start the MCP server and open `/credits`.
- For a live pilot, connect the live VOOPA Stripe account with card payments enabled. Configure Stripe to deliver `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded` to `/billing/stripe-webhook`. Keep the Stripe key and signing secret in the service’s secret settings.
- Live mode requires HTTPS and durable storage. For Cloudflare D1, apply `credit-ledger-d1.sql` to a dedicated database and bind it as `CREDITS` to `credit-storage-worker.mjs` with Node.js compatibility enabled. Set a random `LEDGER_TOKEN` on the Worker and pass that secret and its HTTPS query URL as `RENDER_CHECK_D1_TOKEN` and `RENDER_CHECK_D1_ENDPOINT` in Render. Alternatively, mount a persistent disk at `/var/data`, point `RENDER_CHECK_BILLING_DB` there, and set `RENDER_CHECK_DURABLE_STORAGE=1` on a single hosted instance. Set `RENDER_CHECK_BILLING_MODE=live` after verifying checkout and recovery. The free preview filesystem cannot retain purchased credits.
- This first pilot uses a private bearer key for access. Customers must keep a copy. Self-service key recovery, partial refunds, and automated dispute handling are outside the pilot. Review those limits before public paid rollout.
