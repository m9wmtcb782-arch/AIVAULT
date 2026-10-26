/**
 * @aivault/public-material-learn
 * Public same-source match → fetch → Dark Star learn stub.
 * NOT TronClass credential sync.
 */
export * from './types.js';
export { normalizeTitle, tokenize, decodeNameParam, toNormalizedQuery, resolveRawTitle, } from './normalize.js';
export { matchMaterial, scoreAgainstEntry, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, } from './match.js';
export { PublicSourceRegistry, builtinMohwCatalog, isUrlAllowed, DEFAULT_ALLOWLIST, } from './registry.js';
export { buildPublicProvenance, assertPublicNotTronclassE2e } from './provenance.js';
export { PublicMaterialFetcher, sha256Hex } from './fetch.js';
export { learnNotify, enqueueClassify, onLearnNotify, onClassifyEnqueue, resetLearnHandlersForTests, buildLearnEvent, ingestStub, } from './learn.js';
export { PublicLearnPipeline } from './pipeline.js';
export const PIPELINE_KIND = 'public_material_learn';
export const TRONCLASS_LOGIN_ENABLED = false;
