import { runOnce } from './runtime.mjs';
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const body = await req.json().catch(() => ({}));
  if (body.action === 'status') {
    return Response.json({ ok: true, instance: 'base-001:technical-dark-star', heartbeat: new Date().toISOString() });
  }
  const result = await runOnce({ body });
  return Response.json(result);
});
