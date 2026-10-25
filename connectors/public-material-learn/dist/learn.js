import { assertPublicNotTronclassE2e } from './provenance.js';
const learnHandlers = [];
const classifyHandlers = [];
export function resetLearnHandlersForTests() {
    learnHandlers.length = 0;
    classifyHandlers.length = 0;
}
export function onLearnNotify(handler) {
    learnHandlers.push(handler);
}
export function onClassifyEnqueue(handler) {
    classifyHandlers.push(handler);
}
export async function learnNotify(event) {
    if (event.provenance !== 'public_source') {
        throw new Error('learnNotify requires provenance=public_source');
    }
    if (event.tronclassE2eSuccess !== false) {
        throw new Error('learnNotify requires tronclassE2eSuccess=false');
    }
    for (const h of learnHandlers) {
        await h(event);
    }
    if (learnHandlers.length === 0) {
        console.info('[public-learn:learnNotify:stub]', JSON.stringify(event));
    }
}
export async function enqueueClassify(payload) {
    for (const h of classifyHandlers) {
        try {
            await h(payload);
        }
        catch (err) {
            console.warn('[public-learn:classify] enqueue failed (non-blocking):', err.message);
        }
    }
    if (classifyHandlers.length === 0) {
        console.info('[public-learn:classify:stub]', {
            fileId: payload.fileId,
            fileName: payload.fileName,
            sha256: payload.sha256,
            provenanceSource: payload.provenanceSource,
        });
    }
}
export function buildLearnEvent(ingest, matchScore) {
    assertPublicNotTronclassE2e(ingest.provenance);
    return {
        type: 'darkstar.public_material.learn',
        provenance: 'public_source',
        tronclassE2eSuccess: false,
        title: ingest.title,
        sha256: ingest.sha256,
        sourceUrl: ingest.provenance.sourceUrl,
        catalogId: ingest.provenance.catalogId,
        chunksIndexed: 0,
        citeAs: ingest.provenance.citeAs ?? '公開同源稿',
        matchScore,
    };
}
/** Ingest stub — does not write Dark Star production pages. */
export function ingestStub(opts) {
    assertPublicNotTronclassE2e(opts.provenance);
    return {
        title: opts.title,
        fileName: opts.fileName,
        sha256: opts.sha256,
        privatePathHint: `private/public-learn/${opts.provenance.catalogId ?? 'unknown'}/${opts.sha256.slice(0, 12)}_${opts.fileName}`,
        provenance: opts.provenance,
    };
}
