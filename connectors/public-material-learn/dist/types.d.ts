/**
 * Public same-source learn pipeline types.
 * Strictly separate from TronClass login sync.
 */
export type ProvenanceSource = 'public_source' | 'tronclass_private' | 'manual';
export interface MaterialListItem {
    /** Course title (optional) */
    courseTitle?: string;
    /** File name or display title */
    fileName?: string;
    /** Decoded TronClass download `name=` param (NOT a password) */
    tronclassNameParam?: string;
    /** Free-form hints: agency, doc number, keywords */
    hints?: string[];
    /** Optional known public URL candidate (still must pass allowlist) */
    candidateUrl?: string;
    /** Optional page count / abstract fingerprint */
    pageCount?: number;
    abstractFingerprint?: string;
    sha256?: string;
    /** Human lock — matcher must not override */
    humanLock?: boolean;
    humanChosenUrl?: string;
}
export interface NormalizedQuery {
    rawTitle: string;
    normalizedTitle: string;
    tokens: string[];
    hints: string[];
    courseTitle?: string;
}
export interface PublicCatalogEntry {
    id: string;
    title: string;
    normalizedTitle: string;
    url: string;
    keywords: string[];
    agency?: string;
    pageCount?: number;
    abstractFingerprint?: string;
    sha256?: string;
    citeAs: string;
}
export interface MatchCandidate {
    entry: PublicCatalogEntry;
    score: number;
    reasons: string[];
}
export interface MatchResult {
    query: NormalizedQuery;
    best?: MatchCandidate;
    candidates: MatchCandidate[];
    decision: 'auto_accept' | 'pending_review' | 'no_match' | 'human_locked';
}
export interface MaterialProvenance {
    source: ProvenanceSource;
    sourceSystem: string;
    sourceUrl?: string;
    catalogId?: string;
    retrievedAt: string;
    /** Always false on this pipeline */
    tronclassE2eSuccess: false;
    matchScore?: number;
    matchReasons?: string[];
    citeAs?: string;
}
export interface FetchResult {
    ok: boolean;
    bytes?: Uint8Array;
    sha256?: string;
    url?: string;
    provenance: MaterialProvenance;
    tronclassE2eSuccess: false;
    publicSourceSuccess: boolean;
    error?: string;
}
export interface IngestRecord {
    title: string;
    sha256: string;
    privatePathHint: string;
    provenance: MaterialProvenance;
    fileName: string;
}
export interface ClassifyEnqueuePayload {
    fileId: string;
    fileName: string;
    courseId: string;
    courseCode: string;
    academicYear: string;
    semester: string;
    sha256: string;
    privatePath: string;
    provenanceSource: ProvenanceSource;
}
export interface LearnNotifyEvent {
    type: 'darkstar.public_material.learn';
    provenance: 'public_source';
    tronclassE2eSuccess: false;
    title: string;
    sha256: string;
    sourceUrl?: string;
    catalogId?: string;
    chunksIndexed: number;
    citeAs: string;
    matchScore?: number;
}
export interface PipelineStepResult {
    item: MaterialListItem;
    match: MatchResult;
    fetch?: FetchResult;
    ingest?: IngestRecord;
    classifyEnqueued: boolean;
    learnNotified: boolean;
    learnEvent?: LearnNotifyEvent;
    pendingReview: boolean;
    blockedReason?: string;
}
export interface PipelineRunSummary {
    results: PipelineStepResult[];
    learnNotifyCallCount: number;
    /** Hard invariant for reports */
    anyTronclassE2eSuccess: false;
    publicSourceSuccessCount: number;
}
export interface MatchThresholds {
    autoAcceptThreshold: number;
    reviewThreshold: number;
}
export interface MatchWeights {
    exactNormalizedTitle: number;
    tokenOverlap: number;
    keywordHit: number;
    fingerprintBonus: number;
}
