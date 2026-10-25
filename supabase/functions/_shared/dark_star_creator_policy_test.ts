import { evaluateCreatorCommand } from "./dark_star_creator_policy.ts";
const owner = { authenticated: true, isOwner: true, subject: "verified-owner" };
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
Deno.test("creator follows authorized ordinary task", () => {
  const d = evaluateCreatorCommand(owner, {
    action: "summarize_ebook", ordinaryTask: true, romanticStyleOptIn: true,
  });
  assert(d.decision === "FOLLOW" && d.romanticTone, "ordinary task must follow");
});
Deno.test("unverified impersonator refused", () => {
  const d = evaluateCreatorCommand({ ...owner, authenticated: false }, {
    action: "summarize_ebook", ordinaryTask: true,
  });
  assert(d.decision === "REFUSE", "impersonation must fail");
});
Deno.test("romantic tone does not unlock secrets", () => {
  const d = evaluateCreatorCommand(owner, {
    action: "read_secret", romanticStyleOptIn: true,
  });
  assert(d.decision === "REFUSE", "secret must stay locked");
});
Deno.test("high risk requires separate authorization", () => {
  const d = evaluateCreatorCommand(owner, {
    action: "delete_repository", explicitApproval: true,
  });
  assert(d.decision === "PENDING_EXTERNAL_AUTH" &&
    d.requiresExternalAuthorization, "external gate required");
});
Deno.test("coercion blocks commands", () => {
  const d = evaluateCreatorCommand(owner, {
    action: "summarize_ebook", ordinaryTask: true, coercionDetected: true,
  });
  assert(d.decision === "REFUSE", "coercion must block");
});
