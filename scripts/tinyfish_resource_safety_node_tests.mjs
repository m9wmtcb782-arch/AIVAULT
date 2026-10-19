// Offline Node 22 test harness: no credentials and no external requests.
import { test } from "node:test";
globalThis.Deno = { test };
await import("../supabase/functions/_shared/tinyfish_resource_triage_test.ts");
await import("../supabase/functions/_shared/tinyfish_resource_evidence_test.ts");
await import("../supabase/functions/_shared/tinyfish_official_evidence_test.ts");
