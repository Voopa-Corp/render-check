const el = (id) => document.getElementById(id);
const storageKey = 'voopa-render-check-account';
let token = localStorage.getItem(storageKey);
let attempt = sessionStorage.getItem('render-check-checkout-attempt');
const checkout = new URLSearchParams(location.search).get('checkout');
if (checkout) {
  attempt = null;
  sessionStorage.removeItem('render-check-checkout-attempt');
  history.replaceState(null, '', '/credits');
}
const message = (value) => { el('message').textContent = value; };
async function call(path, data) {
  const response = await fetch('/billing/' + path, {
    method: data ? 'POST' : 'GET',
    headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error);
    error.status = response.status;
    throw error;
  }
  return result;
}
async function refresh() {
  const result = await call('balance');
  el('balance').textContent = result.balance;
  el('key').textContent = token;
  el('endpoint').textContent = location.origin + '/mcp/paid';
  el('account').hidden = false;
  el('setup').hidden = true;
  el('buy').disabled = false;
}
el('create').onclick = async () => {
  el('create').disabled = true;
  try {
    const account = await call('account', {});
    token = account.token;
    localStorage.setItem(storageKey, token);
    await refresh();
    message('Your review key is ready. Keep a copy before purchasing.');
  } catch (error) { message(error.message); }
  finally { el('create').disabled = false; }
};
el('restore').onsubmit = async (event) => {
  event.preventDefault();
  token = el('restore-key').value.trim();
  try {
    await refresh();
    localStorage.setItem(storageKey, token);
    el('restore-key').value = '';
    message('Review key connected.');
  } catch (error) { token = null; message(error.message); }
};
el('refresh').onclick = () => refresh().catch((error) => message(error.message));
el('buy').onclick = async () => {
  el('buy').disabled = true;
  attempt ??= crypto.randomUUID();
  sessionStorage.setItem('render-check-checkout-attempt', attempt);
  try {
    const result = await call('checkout', { attempt });
    location.assign(result.url);
  } catch (error) {
    if (error.status === 409) {
      attempt = null;
      sessionStorage.removeItem('render-check-checkout-attempt');
    }
    message(error.message);
    el('buy').disabled = false;
  }
};
async function start() {
  const pack = await call('pack');
  el('pack').textContent = pack.credits + ' completed reviews for $' + (pack.amount / 100).toFixed(2) + ' USD.';
  el('mode').textContent = pack.live ? 'One-time payment. Top up when you choose.' : 'Test mode. No real payment is collected.';
  if (token) {
    try { await refresh(); } catch (error) { message(error.message); }
  }
  if (checkout === 'complete') message('Stripe returned you to Render Check. Refresh your balance once payment is confirmed.');
  if (checkout === 'cancelled') message('Checkout was cancelled.');
}
start().catch((error) => message(error.message));
