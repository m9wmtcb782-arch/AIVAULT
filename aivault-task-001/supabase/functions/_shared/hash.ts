function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256:" + hex(digest);
}

export function parseCas(uri: string): { bucket?: string; key: string } | null {
  if (!uri.startsWith("aivault-cas://")) return null;
  const rest = uri.slice("aivault-cas://".length);
  const i = rest.indexOf("/");
  if (i <= 0) return { key: rest };
  return { bucket: rest.slice(0, i), key: rest.slice(i + 1) };
}

export async function fetchImageBytes(imageUri: string): Promise<ArrayBuffer> {
  if (imageUri.startsWith("https://")) {
    const res = await fetch(imageUri);
    if (!res.ok) throw new Error("image_fetch_failed:" + res.status);
    return await res.arrayBuffer();
  }
  if (imageUri.startsWith("aivault-cas://")) {
    const parsed = parseCas(imageUri);
    if (!parsed) throw new Error("cas_uri_invalid");
    const base = Deno.env.get("AIVAULT_CAS_BASE_URL") ?? "";
    if (base) {
      const url = base.replace(/\/$/, "") + "/" + parsed.key;
      const res = await fetch(url);
      if (!res.ok) throw new Error("cas_fetch_failed:" + res.status);
      return await res.arrayBuffer();
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const bucket = parsed.bucket || Deno.env.get("AIVAULT_CAS_BUCKET") || "aivault-cas";
    const { data, error } = await sb.storage.from(bucket).download(parsed.key);
    if (error || !data) throw new Error("cas_storage_failed:" + (error?.message ?? "empty"));
    return await data.arrayBuffer();
  }
  throw new Error("image_uri_scheme_unsupported");
}

export async function recomputeContentHash(imageUri: string): Promise<string> {
  const bytes = await fetchImageBytes(imageUri);
  return sha256Bytes(bytes);
}
