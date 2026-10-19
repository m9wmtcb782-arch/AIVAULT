// Execute Deno.test-style pure unit tests under Node 22 without Deno or API credentials.
import { test } from "node:test";
globalThis.Deno = { test };
await import("../supabase/functions/_shared/openrouter_free_inference_test.ts");
await import("../supabase/functions/_shared/aivault_model_admission_test.ts");
await import("../supabase/functions/_shared/aivault_external_egress_test.ts");
await import("../supabase/functions/_shared/aivault_public_task_allowlist_test.ts");
