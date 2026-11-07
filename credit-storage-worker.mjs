import { timingSafeEqual } from 'node:crypto';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/query') {
      return new Response(null, { status: 404 });
    }
    const expected = Buffer.from('Bearer ' + env.LEDGER_TOKEN);
    const authorization = Buffer.from(request.headers.get('Authorization') ?? '');
    if (!env.LEDGER_TOKEN || expected.length !== authorization.length || !timingSafeEqual(expected, authorization)) {
      return new Response(null, { status: 401 });
    }
    try {
      const { sql, params } = await request.json();
      const result = await env.CREDITS.prepare(sql).bind(...params).all();
      return Response.json({ success: true, result: [result] });
    } catch {
      return Response.json({ success: false }, { status: 503 });
    }
  },
};
