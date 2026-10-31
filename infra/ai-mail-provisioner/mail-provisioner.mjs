/**
 * AIVAULT AI Mail Provisioner v0.1
 * Isolated module. No modifications to Gateway, Cognitive or Governance engines.
 * Node 20+; no third-party dependencies.
 * Dry run by default. Real provisioning requires an approved provider adapter,
 * an owned domain, and explicit owner authorization.
 */
import { randomBytes } from "node:crypto";

export function identityCode(n) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new Error("Invalid AI number");
  if (n === 100000) return "10W";
  const places = [[10000,"W"],[1000,"K"],[100,"H"],[10,"T"],[1,"U"]];
  return places.map(([place,unit]) => {
    const digit = Math.floor(n/place)%10;
    return digit ? `${digit}${unit}` : "";
  }).join("");
}
export function makeMailboxCandidate({agentId, number, romanizedName, domain}) {
  if (!/^Worker-\d+$/.test(agentId)) throw new Error("Invalid agentId");
  const name = romanizedName.toLowerCase().replace(/\s+/g,"");
  if (!/^[a-z]{2,40}$/.test(name)) throw new Error("Provide verified ASCII romanization");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error("Invalid domain");
  const localPart = `${name}${identityCode(number).toLowerCase()}`;
  return {agentId, number, localPart, email: `${localPart}@${domain.toLowerCase()}`};
}
export function generatePassword() {
  return randomBytes(32).toString("base64url");
}
export async function provisionMailbox(input, {provider, authorized=false, dryRun=true, audit=()=>{}}={}) {
  const candidate = makeMailboxCandidate(input);
  const emit = (event, extra={}) => audit({event,agentId:candidate.agentId,...extra});
  if (dryRun) {
    emit("MAIL_PROVISION_DRY_RUN");
    return {status:"DRY_RUN",...candidate,created:false};
  }
  if (!authorized) throw new Error("OWNER_APPROVAL_REQUIRED");
  if (!provider || typeof provider.createMailbox !== "function") throw new Error("APPROVED_PROVIDER_REQUIRED");
  if (provider.approved !== true || provider.costApproved !== true) throw new Error("PROVIDER_POLICY_OR_COST_NOT_APPROVED");
  if (typeof provider.storeCredential !== "function") throw new Error("ENCRYPTED_CREDENTIAL_STORE_REQUIRED");
  const password = generatePassword();
  // Adapter must use official provider API, handle rate limits, verify idempotency,
  // and never log or persist plaintext credentials.
  const result = await provider.createMailbox({email:candidate.email,password,idempotencyKey:candidate.agentId});
  if (!result?.mailboxId) throw new Error("PROVIDER_CREATE_NOT_CONFIRMED");
  try {
    await provider.storeCredential({agentId:candidate.agentId,mailboxId:result.mailboxId,password});
  } catch (err) {
    emit("MAIL_CREDENTIAL_STORAGE_FAILED", {mailboxId:result.mailboxId});
    throw new Error("MAILBOX_CREATED_BUT_CREDENTIAL_STORAGE_FAILED_MANUAL_RECOVERY");
  }
  emit("MAIL_PROVISIONED", {mailboxId:result.mailboxId});
  return {status:"PROVISIONED",...candidate,mailboxId:result.mailboxId,created:true};
}
