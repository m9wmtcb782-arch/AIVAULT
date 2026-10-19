// Server-side TinyFish quota RPC adapter. Never expose the service-role key to clients.
// The database gate defaults to disabled; no requests are authorized until explicitly enabled.
export function createTinyFishQuotaLease(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetcher: typeof fetch = fetch,
): (provider: "tinyfish_search") => Promise<boolean> {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl) ||
      !serviceRoleKey) throw new Error("TINYFISH_QUOTA_BACKEND_NOT_CONFIGURED");
  const url = supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/aivault_tinyfish_acquire_lease";
  return async (provider) => {
    if (provider !== "tinyfish_search") return false;
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: "Bearer " + serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: "{}",
        redirect: "error",
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;
      const result: unknown = await response.json();
      return result === true;
    } catch {
      return false;
    }
  };
}
