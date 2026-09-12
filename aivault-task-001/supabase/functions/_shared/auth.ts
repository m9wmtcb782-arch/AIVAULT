import { json } from "./contract.ts";

const HEADER = "x-aivault-internal";

export function requireInternal(req: Request): Response | null {
  if (req.method === "OPTIONS") return null;
  const secret = Deno.env.get("AIVAULT_INTERNAL_SECRET") ?? "";
  if (!secret) {
    return json({ error: "internal_secret_not_configured" }, 503);
  }
  const got = req.headers.get(HEADER) ?? "";
  if (got.length !== secret.length || got !== secret) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}
