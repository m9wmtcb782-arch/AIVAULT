# AIVAULT AI Mail Provisioner — 001 pilot

Status: **DRY RUN ONLY**. No real mailbox has been created.

AI 001: Worker-001 / 凌安安 / linganan / 1U.
Example candidate: linganan1u@example.org (**example.org is a placeholder, not a registered mailbox**).

Run: `node --test infra/ai-mail-provisioner/mail-provisioner.test.mjs` (Node 20+).

## Production prerequisites
1. Owner-controlled domain and a mailbox provider explicitly permitting API provisioning.
2. Written owner approval for any spend; verify provider mailbox limits, abuse rules, and quota.
3. Approved provider adapter implementing createMailbox() via its official API.
4. Encrypted credential store implementing storeCredential() and protected server-side API secrets.
5. Governance approval, idempotent provisioning, per-agent access controls, rate limits, audit and verification inbox tests.
6. Never bypass CAPTCHA, identity checks, platform limits or terms. Email ownership does not grant permission to create external accounts.

No Supabase migrations or production function deployments are performed in this pilot.
