import { json } from "./contract.ts";

export const INTERNAL_HEADER = "x-aivault-internal";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function requireInternal(req: Request): Response | null {
  if (req.method === "OPTIONS") return null;
  const secret = Deno.env.get("AIVAULT_INTERNAL_SECRET") ?? "";
  if (!secret) {
    return json({ error: "internal_secret_not_configured" }, 503);
  }
  const got = req.headers.get(INTERNAL_HEADER) ?? "";
  if (!timingSafeEqual(got, secret)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}
