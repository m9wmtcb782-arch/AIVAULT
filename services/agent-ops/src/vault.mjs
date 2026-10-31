// Credential vault abstraction. Callers only ever hold an opaque credential_ref.
// - EncryptedMemoryVault: AES-256-GCM with a 32-byte master key from env (AIVAULT_VAULT_KEY, base64). Tests/local.
// - SupabaseVaultAdapter: stores via server-side RPC wrapping vault.create_secret (service_role only, backend only).
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";

export function generatePassword(bytes = 32) { return randomBytes(bytes).toString("base64url"); }

export class EncryptedMemoryVault {
  constructor({ keyB64 = process.env.AIVAULT_VAULT_KEY, audit = () => {} } = {}) {
    const key = keyB64 ? Buffer.from(keyB64, "base64") : null;
    if (!key || key.length !== 32) throw new Error("VAULT_KEY_REQUIRED_32B");
    this.key = key; this.rows = new Map(); this.audit = audit;
  }
  async put({ owner, secret, kind }) {
    const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", this.key, iv);
    const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
    const ref = "vref_" + randomUUID();
    this.rows.set(ref, { owner, kind, iv, ct, tag: c.getAuthTag() });
    this.audit({ action: "VAULT_PUT", actor: owner, target: ref });
    return ref;
  }
  async get(ref, { requester }) {
    const r = this.rows.get(ref); if (!r) throw new Error("VAULT_REF_NOT_FOUND");
    if (r.owner !== requester) { this.audit({ action: "VAULT_DENIED", actor: requester, target: ref }); throw new Error("VAULT_ACCESS_DENIED"); }
    const d = createDecipheriv("aes-256-gcm", this.key, r.iv); d.setAuthTag(r.tag);
    this.audit({ action: "VAULT_GET", actor: requester, target: ref });
    return Buffer.concat([d.update(r.ct), d.final()]).toString("utf8");
  }
  dumpForTest() { return [...this.rows.values()].map(r => r.ct.toString("hex")).join(""); }
}

export class SupabaseVaultAdapter {
  // Requires a backend-only RPC (not in this branch's live DB): agent_ops.vault_put(owner, secret) / vault_get(ref, requester).
  constructor({ url, serviceKey }) { if (!url || !serviceKey) throw new Error("BACKEND_ONLY_CONFIG_REQUIRED"); Object.assign(this, { url, serviceKey }); }
  async rpc(fn, args) {
    const r = await fetch(`${this.url}/rest/v1/rpc/${fn}`, { method: "POST",
      headers: { apikey: this.serviceKey, Authorization: "Bearer " + this.serviceKey, "Content-Type": "application/json", "Content-Profile": "agent_ops" },
      body: JSON.stringify(args) });
    if (!r.ok) throw new Error("VAULT_RPC_" + r.status); return r.json();
  }
  put({ owner, secret, kind }) { return this.rpc("vault_put", { p_owner: owner, p_secret: secret, p_kind: kind }); }
  get(ref, { requester }) { return this.rpc("vault_get", { p_ref: ref, p_requester: requester }); }
}
