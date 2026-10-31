/**
 * AIVAULT Mail lifecycle v0.2 — provider-neutral orchestration.
 * No real provider is configured. Backend-only. No secrets in logs.
 */
import { generatePassword } from "./mail-provisioner.mjs";

const states = new Set(["NOT_REQUESTED","PENDING","PROVISIONED","VERIFIED","FAILED"]);
function assertAgent(agentId) {
  if (typeof agentId !== "string" || !/^(Worker-\d+|ag-\d+)$/.test(agentId)) throw Error("INVALID_AGENT_ID");
}
export async function runMailboxLifecycle({agentId,email,provider,store,audit=async()=>{},authorized=false,dryRun=true}) {
  assertAgent(agentId);
  if (!email || !/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) throw Error("INVALID_EMAIL");
  if (!authorized || dryRun) return {agentId,email,status:"DRY_RUN",created:false};
  if (!provider?.approved || !provider?.costApproved) throw Error("PROVIDER_NOT_APPROVED");
  for (const method of ["createMailbox","checkVerification","sendTestMessage","checkTestMessage"]) {
    if (typeof provider[method] !== "function") throw Error("PROVIDER_METHOD_MISSING:"+method);
  }
  for (const method of ["get","setStatus","saveCredential"]) {
    if (typeof store?.[method] !== "function") throw Error("STORE_METHOD_MISSING:"+method);
  }
  const existing = await store.get(agentId);
  if (existing?.status === "VERIFIED") return {agentId,email,status:"VERIFIED",created:false,reused:true};
  if (existing?.status === "PROVISIONED") return {agentId,email,status:"PROVISIONED",created:false,requiresVerification:true};
  if (existing?.status === "PENDING") throw Error("PENDING_OPERATION_REQUIRES_RECONCILIATION");
  if (existing?.email && existing.email !== email) throw Error("AGENT_EMAIL_MISMATCH");
  await store.setStatus({agentId,email,status:"PENDING"});
  await audit({agentId,event:"PROVISION_STARTED"});
  let mailboxId;
  try {
    const password = generatePassword();
    const result = await provider.createMailbox({agentId,email,password,idempotencyKey:"mail:"+agentId});
    if (!result?.mailboxId) throw Error("PROVIDER_CREATE_NOT_CONFIRMED");
    mailboxId = result.mailboxId;
    // saveCredential must encrypt secret and return opaque reference only.
    const credentialRef = await store.saveCredential({agentId,email,mailboxId,password});
    if (!credentialRef || typeof credentialRef !== "string") throw Error("CREDENTIAL_REF_REQUIRED");
    await store.setStatus({agentId,email,mailboxId,credentialRef,status:"PROVISIONED"});
    await audit({agentId,event:"PROVISIONED",mailboxId});
    return {agentId,email,mailboxId,status:"PROVISIONED",created:true,requiresVerification:true};
  } catch (error) {
    if (!mailboxId) await store.setStatus({agentId,email,status:"FAILED"});
    // When mailbox exists but credential persistence failed, keep PENDING for recovery.
    await audit({agentId,event:"PROVISION_FAILED",mailboxCreated:!!mailboxId});
    throw error;
  }
}
export async function verifyMailbox({agentId,provider,store,audit=async()=>{}}) {
  assertAgent(agentId);
  const record = await store.get(agentId);
  if (!record || record.status !== "PROVISIONED" || !record.mailboxId) throw Error("MAILBOX_NOT_READY");
  if (!provider?.approved || typeof provider.checkVerification !== "function" ||
      typeof provider.sendTestMessage !== "function" || typeof provider.checkTestMessage !== "function")
    throw Error("VERIFICATION_PROVIDER_REQUIRED");
  const verified = await provider.checkVerification({agentId,mailboxId:record.mailboxId});
  if (!verified) return {agentId,status:"PROVISIONED",verified:false};
  const challenge = await provider.sendTestMessage({agentId,mailboxId:record.mailboxId});
  if (!challenge?.id) throw Error("TEST_MESSAGE_NOT_SENT");
  const received = await provider.checkTestMessage({agentId,mailboxId:record.mailboxId,challengeId:challenge.id});
  if (!received) return {agentId,status:"PROVISIONED",verified:false};
  await store.setStatus({agentId,status:"VERIFIED",verifiedAt:new Date().toISOString()});
  await audit({agentId,event:"VERIFIED"});
  return {agentId,status:"VERIFIED",verified:true};
}
export {states as mailboxStates};
