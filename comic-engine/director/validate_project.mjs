#!/usr/bin/env node
/**
 * P1 director: lightweight consistency checks for a comic-engine project.json.
 * No paid APIs. Does not render video.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.argv[2] || 'comic-engine/projects/_example/project.json');
const raw = readFileSync(path, 'utf8');
const p = JSON.parse(raw);
const errors = [];
const warn = [];

function fail(m) { errors.push(m); }
function note(m) { warn.push(m); }

if (p.schema_version !== '1.0.0') fail(`schema_version must be 1.0.0, got ${p.schema_version}`);
if (!p.governance || p.governance.paid_api_enabled !== false) fail('governance.paid_api_enabled must be false');
const out = p.output || {};
if (out.width !== 1080 || out.height !== 1920 || out.fps !== 30 || out.duration_sec !== 60) {
  fail('output must be 1080x1920 @30fps 60s');
}
if (!Array.isArray(p.characters) || p.characters.length !== 2) fail('exactly 2 characters required');
if (!Array.isArray(p.scenes) || p.scenes.length !== 3) fail('exactly 3 scenes required');
const charIds = new Set((p.characters || []).map((c) => c.id));
const sceneIds = new Set((p.scenes || []).map((s) => s.id));
if (charIds.size !== 2) fail('character ids must be unique');
if (sceneIds.size !== 3) fail('scene ids must be unique');

let covered = 0;
for (const shot of p.timeline || []) {
  if (!sceneIds.has(shot.scene_id)) fail(`shot ${shot.shot_id}: unknown scene_id ${shot.scene_id}`);
  if (!(shot.end_sec > shot.start_sec)) fail(`shot ${shot.shot_id}: end_sec must be > start_sec`);
  if (shot.start_sec < 0 || shot.end_sec > 60) fail(`shot ${shot.shot_id}: outside 0..60`);
  covered = Math.max(covered, shot.end_sec);
  for (const c of shot.cast || []) {
    if (!charIds.has(c.character_id)) fail(`shot ${shot.shot_id}: unknown cast ${c.character_id}`);
  }
  for (const d of shot.dialogue || []) {
    if (!charIds.has(d.character_id)) fail(`shot ${shot.shot_id}: unknown dialogue speaker ${d.character_id}`);
    if (d.start_sec < shot.start_sec || d.end_sec > shot.end_sec) {
      note(`shot ${shot.shot_id}: dialogue outside shot window (${d.text.slice(0, 12)}…)`);
    }
  }
}
if (covered < 60) note(`timeline ends at ${covered}s (V1 target is 60s)`);

if (errors.length) {
  console.error('FAIL', path);
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('OK', path);
for (const w of warn) console.log(' warn:', w);
process.exit(0);
