// SPF / DKIM / DMARC public DNS check (read-only).
import { promises as dns } from "node:dns";
const txt = async (n) => { try { return (await dns.resolveTxt(n)).map(a => a.join("")); } catch (e) { return { error: e.code }; } };
export async function checkMailDns(domain, { dkimSelector } = {}) {
  const out = { domain, checkedAt: new Date().toISOString() };
  try { out.mx = await dns.resolveMx(domain); } catch (e) { out.mx = { error: e.code }; }
  const root = await txt(domain);
  out.spf = Array.isArray(root) ? root.filter(t => t.startsWith("v=spf1")) : root;
  const dm = await txt("_dmarc." + domain);
  out.dmarc = Array.isArray(dm) ? dm.filter(t => t.startsWith("v=DMARC1")) : dm;
  if (dkimSelector) { const dk = await txt(`${dkimSelector}._domainkey.${domain}`); out.dkim = Array.isArray(dk) ? dk.filter(t => t.includes("v=DKIM1")) : dk; }
  out.ok = Array.isArray(out.mx) && out.mx.length > 0 && Array.isArray(out.spf) && out.spf.length === 1
    && Array.isArray(out.dmarc) && out.dmarc.length === 1 && (!dkimSelector || (Array.isArray(out.dkim) && out.dkim.length > 0));
  return out;
}
