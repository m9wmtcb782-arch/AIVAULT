export function buildPublicProvenance(opts) {
    return {
        source: 'public_source',
        sourceSystem: opts.url ?? opts.entry?.url ?? 'public_source',
        sourceUrl: opts.url ?? opts.entry?.url,
        catalogId: opts.entry?.id,
        retrievedAt: opts.retrievedAt ?? new Date().toISOString(),
        tronclassE2eSuccess: false,
        matchScore: opts.matchScore,
        matchReasons: opts.matchReasons,
        citeAs: opts.entry?.citeAs,
    };
}
export function assertPublicNotTronclassE2e(p) {
    if (p.source === 'public_source' && p.tronclassE2eSuccess) {
        throw new Error('FORBIDDEN: public_source marked tronclassE2eSuccess=true');
    }
    if (p.tronclassE2eSuccess) {
        throw new Error('FORBIDDEN: this pipeline must keep tronclassE2eSuccess=false');
    }
}
