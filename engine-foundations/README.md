# AIVAULT Engine Foundations V0

Status: SCAFFOLD_ONLY. No model weights, live inference, external API, or deployment.
Scope: isolated branch; no edits to Dark Star, Dawn Light, main, or Supabase.

## Core engines
reasoning, understanding, memory, discovery, dispatch, verification, learning, factory, compute

## Specialist engines
text, image, video, speech, singing, composition

## Contract
Each engine has: id, kind, capabilities, implementation, version, status.
- scaffold: interface only
- implemented: real code present
- verified: passed representative end-to-end evaluation
- production: deployed with operational evidence

All calls must produce evidence of execution. No fake answers. No paid providers by default.
Persist only compact metadata, hashes, source links, reproducible failure/fix records.
Shared DB budget proposal: 100 MB (not allocated).

## Progression
V0 registry and interfaces -> V1 actual CPU implementation -> V2 integration -> V3 measured improvements.
First vertical slice: Worker-0001 -> understanding -> reasoning -> verification -> shared memory.
Singing requires a genuine singing-voice-synthesis model, not speech TTS.

## Safety
Do not expose secrets in browser; do not run Grok/Kling/other paid APIs without authorization.
Do not claim 300k worker records imply 300k running models.
