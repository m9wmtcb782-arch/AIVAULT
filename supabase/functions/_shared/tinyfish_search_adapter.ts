// External-only AIVAULT discovery adapter. Does not call model inference APIs.
// Must only run server-side, after owner approves TinyFish terms and creates one key.
// Search API contract checked against published documentation; live authentication is NOT verified.
import type { AuthorizedSearchAdapter, SearchHit } from "./free_discovery_worker.ts";
import { createTinyFishQuotaLease } from "./tinyfish_quota_lease.ts";

export type TinyFishQuotaLease = (provider: "tinyfish_search") => Promise<boolean>;

export type TinyFishAdapterConfig = {
  enabled: boolean;
  apiKey: string | undefined;
  endpoint: string;
  maxRequestsPerMinute: number;
  termsApproved: boolean;
  // Must be a database-atomic, account-wide quota lease. No lease = no request.
  acquireQuotaLease: TinyFishQuotaLease;
};
const ALLOWED_HOST = "api.search.tinyfish.ai";
// TinyFish Search: GET /?query=...&location=... ; X-API-Key authentication.
// Server-side construction: quota lease is acquired through Supabase before every search.
export function createTinyFishServerAdapter(
  config: Omit<TinyFishAdapterConfig, "acquireQuotaLease">,
  supabaseUrl: string,
  serviceRoleKey: string,
  fetcher: typeof fetch = fetch,
): AuthorizedSearchAdapter {
  return createTinyFishSearchAdapter({
    ...config,
    acquireQuotaLease: createTinyFishQuotaLease(supabaseUrl, serviceRoleKey, fetcher),
  }, fetcher);
}

export function createTinyFishSearchAdapter(
  config: TinyFishAdapterConfig,
  fetcher: typeof fetch = fetch,
): AuthorizedSearchAdapter {
  let endpoint: URL;
  try { endpoint = new URL(config.endpoint); }
  catch { throw new Error("TINYFISH_ENDPOINT_NOT_ALLOWED"); }
  if (endpoint.protocol !== "https:" || endpoint.hostname !== ALLOWED_HOST ||
      endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash || endpoint.pathname !== "/") {
    throw new Error("TINYFISH_ENDPOINT_NOT_ALLOWED");
  }
  if (!config.enabled || !config.termsApproved || !config.apiKey) {
    throw new Error("TINYFISH_NOT_AUTHORIZED");
  }
  if (!Number.isSafeInteger(config.maxRequestsPerMinute) ||
      config.maxRequestsPerMinute !== 5) {
    throw new Error("TINYFISH_RATE_LIMIT_INVALID");
  }
  if (typeof config.acquireQuotaLease !== "function") {
    throw new Error("TINYFISH_GLOBAL_QUOTA_REQUIRED");
  }
  const authorizedApiKey: string = config.apiKey;
  // Fail closed: all workers must acquire one shared atomic quota lease.
  return {
    async search(query: string, region: string, maxResults: number): Promise<SearchHit[]> {
      if (typeof query !== "string" || typeof region !== "string" ||
          query.length < 5 || query.length > 300 ||
          !/^[a-zA-Z-]{2,20}$/.test(region) ||
          !Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 10) {
        throw new Error("INVALID_SEARCH_REQUEST");
      }
      if (!(await config.acquireQuotaLease("tinyfish_search"))) {
        throw new Error("TINYFISH_QUOTA_EXHAUSTED");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        // Contract is deliberately explicit; verify against current official
        // REST documentation before enabling the adapter in production.
        const searchUrl = new URL(endpoint.href);
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("location", region.toUpperCase());
        const response = await fetcher(searchUrl.href, {
          method: "GET",
          headers: {
            "X-API-Key": authorizedApiKey,
          },
          signal: controller.signal,
          redirect: "error",
        });
        if (!response.ok) throw new Error("SEARCH_HTTP_" + response.status);
        const len = Number(response.headers.get("content-length") || 0);
        if (len > 262144) throw new Error("SEARCH_RESPONSE_TOO_LARGE");
        // Bound memory even when the server omits or lies about Content-Length.
        if (!response.body) throw new Error("SEARCH_RESPONSE_UNVERIFIED");
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let totalBytes = 0;
        let raw = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > 262144) throw new Error("SEARCH_RESPONSE_TOO_LARGE");
            raw += decoder.decode(value, { stream: true });
          }
          raw += decoder.decode();
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        const json: unknown = JSON.parse(raw);
        if (!json || typeof json !== "object" ||
            !("results" in json) || !Array.isArray(json.results)) {
          throw new Error("SEARCH_RESPONSE_UNVERIFIED");
        }
        return json.results.slice(0, maxResults).flatMap((entry: unknown) => {
          if (!entry || typeof entry !== "object") return [];
          const item = entry as Record<string, unknown>;
          if (typeof item.url !== "string") return [];
          const candidateUrl = item.url.startsWith("https://") || item.url.startsWith("http://")
            ? item.url : "https://" + item.url;
          let parsedUrl: URL;
          try { parsedUrl = new URL(candidateUrl); } catch { return []; }
          if (!["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) return [];
          return [{
            title: typeof item.title === "string" ? item.title.slice(0, 200) : "",
            url: parsedUrl.href,
            snippet: typeof item.snippet === "string" ? item.snippet.slice(0, 600) : "",
          }];
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
// NOT PRODUCTION READY: live-test API response,
// add shared distributed quota lease, and get explicit user activation approval.
