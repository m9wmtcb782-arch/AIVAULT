// LOCAL ONLY test mail system: one SMTP server (smtp-server, AUTH required) delivering to per-address IMAP servers (hoodiecrow).
// This is NOT the public internet; results are labeled LOCAL.
import { SMTPServer } from "smtp-server";
import { createRequire } from "node:module";
const hoodiecrow = createRequire(import.meta.url)("hoodiecrow-imap");
export async function startLocalMail(accounts) { // accounts: {address: password}
  const imaps = {}, ports = {};
  for (const [addr, pass] of Object.entries(accounts)) {
    const s = hoodiecrow({ users: { [addr]: { password: pass } }, storage: { INBOX: { messages: [] } } });
    await new Promise(r => s.listen(0, "127.0.0.1", r)); imaps[addr] = s; ports[addr] = s.server ? s.server.address().port : s.address().port;
  }
  const smtp = new SMTPServer({ authOptional: false, disabledCommands: ["STARTTLS"], allowInsecureAuth: true,
    onAuth(a, _s, cb) { accounts[a.username] === a.password ? cb(null, { user: a.username }) : cb(new Error("bad auth")); },
    onRcptTo(addr, _s, cb) { imaps[addr.address] ? cb() : cb(Object.assign(new Error("550 no such user"), { responseCode: 550 })); },
    onData(stream, session, cb) { const ch = []; stream.on("data", c => ch.push(c)); stream.on("end", () => {
      const raw = Buffer.concat(ch).toString("binary");
      for (const r of session.envelope.rcptTo) imaps[r.address].appendMessage("INBOX", [], new Date(), raw);
      cb(); }); } });
  await new Promise(r => smtp.listen(0, "127.0.0.1", r));
  return { smtpPort: smtp.server.address().port, imapPort: a => ports[a],
    async close() { smtp.close(); for (const s of Object.values(imaps)) (s.server || s).close(); } };
}
