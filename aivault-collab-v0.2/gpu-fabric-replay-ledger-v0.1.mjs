/**
 * Durable fail-closed stage reservations on a trusted local filesystem.
 * mkdir is the atomic claim; file + directory fsync precede backend execution.
 * Existing/incomplete claims are never retried or automatically deleted.
 */
import { createHash } from "node:crypto";
import { isAbsolute, join, dirname } from "node:path";
import { mkdirSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync } from "node:fs";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
function syncDirectory(path) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function createFileReplayLedger({ directory }) {
  if (typeof directory !== "string" || !isAbsolute(directory)) throw new Error("absolute ledger directory required");
  // Caller provisions a private durable parent; no recursive transient storage.
  try { mkdirSync(directory, { mode: 0o700 }); } catch (e) { if (e.code !== "EEXIST") throw e; }
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) {
    throw new Error("ledger directory must be private and must not be a symlink");
  }
  syncDirectory(directory);
  syncDirectory(dirname(directory));
  return {
    durability: "FSYNC_STAGE_RESERVATION",
    reserve({ localNodeId, senderNodeId, jobId, operationId, tensorId, messageId, payloadSha256 }) {
      const identity = [localNodeId, senderNodeId, jobId, operationId, tensorId];
      if (!identity.every(x => typeof x === "string" && ID.test(x)) ||
          typeof messageId !== "string" || !ID.test(messageId) ||
          typeof payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(payloadSha256)) {
        throw new Error("invalid replay reservation");
      }
      // Deliberately excludes token, message ID and checksum: rotating a token
      // or changing data must not execute the same logical stage twice.
      const key = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
      const path = join(directory, key);
      try { mkdirSync(path, { mode: 0o700 }); } catch (e) {
        if (e.code === "EEXIST") return false;
        throw e;
      }
      // Any error leaves a tombstone, denying later attempts.
      const fd = openSync(join(path, "reservation.json"), "wx", 0o600);
      try {
        writeFileSync(fd, JSON.stringify({ version: 1, identity, message_id: messageId,
          payload_sha256: payloadSha256, state: "RESERVED_OUTCOME_UNKNOWN" }) + "\n");
        fsyncSync(fd);
      } finally { closeSync(fd); }
      syncDirectory(path);
      syncDirectory(directory);
      return true;
    },
  };
}
