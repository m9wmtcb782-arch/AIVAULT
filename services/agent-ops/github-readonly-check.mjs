// EXTERNAL read-only check: uses GH_TOKEN from env (never logged). Calls /user and /notifications only.
import { GitHubConnector } from "./src/github-connector.mjs";
import { GovernanceAdapter } from "./src/governance.mjs";
const gh = new GitHubConnector({ tokenProvider: async () => { if (!process.env.GH_TOKEN) throw new Error("NO_TOKEN"); return process.env.GH_TOKEN; }, governance: new GovernanceAdapter() });
const login = await gh.whoami(); const n = await gh.notifications();
console.log(JSON.stringify({ label: "EXTERNAL_READ_ONLY", at: new Date().toISOString(), login, notifications_count: n.length, sample: n.slice(0, 3).map(x => ({ reason: x.reason, repo: x.repo, type: x.type })) }, null, 2));
