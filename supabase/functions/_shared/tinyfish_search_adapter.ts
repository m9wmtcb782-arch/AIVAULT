// External-only AIVAULT discovery adapter. Does not call model inference APIs.
// Must only run server-side, after owner approves TinyFish terms and creates one key.
// API endpoint/response mapping requires live verification before production deployment.
import type { AuthorizedSearchAdapter, SearchHit } from "./free_discovery_worker.ts";

export type TinyFishAdapterConfig = {
  enabled: boolean;
  apiKey: string | undefined;
  endpoint: string;
  maxRequestsPerMinute: number;
  termsApproved: boolean;
};
const ALLOWED_HOST = "api.search.tinyfish.ai";
// TinyFish Search: GET /?query=...&location=... ; X-API-Key authentication.
export function createTinyFishSearchAdapter(
  config: TinyFishAdapterConfig,
  fetcher: typeof fetch = fetch,
): AuthorizedSearchAdapter {
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.hostname !== ALLOWED_HOST ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/") {
    throw new Error("TINYFISH_ENDPOINT_NOT_ALLOWED");
  }
  if (!config.enabled || !config.termsApproved || !config.apiKey) {
    throw new Error("TINYFISH_NOT_AUTHORIZED");
  }
  if (!Number.isSafeInteger(config.maxRequestsPerMinute) ||
      config.maxRequestsPerMinute < 1 || config.maxRequestsPerMinute > 30) {
    throw new Error("TINYFISH_RATE_LIMIT_INVALID");
  }
  // The enclosing worker must enforce a distributed, account-wide quota.
  // A per-instance limiter would not protect 2,000 workers sharing one key.
  return {
    async search(query: string, region: string, maxResults: number): Promise<SearchHit[]> {
      if (query.length < 5 || query.length > 300 ||
          !/^[a-zA-Z-]{2,20}$/.test(region) ||
          !Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 10) {
        throw new Error("INVALID_SEARCH_REQUEST");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        // Contract is deliberately explicit; verify against current official
        // REST documentation before enabling the adapter in production.
        const response = await fetcher(endpoint.href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.apiKey,
          },
          body: JSON.stringify({ query, region, max_results: maxResults }),
          signal: controller.signal,
          redirect: "error",
        });
        if (!response.ok) throw new Error("SEARCH_HTTP_" + response.status);
        const len = Number(response.headers.get("content-length") || 0);
        if (len > 262144) throw new Error("SEARCH_RESPONSE_TOO_LARGE");
        const raw = await response.text();
        if (raw.length > 262144) throw new Error("SEARCH_RESPONSE_TOO_LARGE");
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
// NOT PRODUCTION READY: verify API endpoint and payload against TinyFish docs,
// add shared distributed quota lease, and get explicit user activation approval.
