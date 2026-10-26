import type { ClassifyEnqueuePayload, IngestRecord, LearnNotifyEvent } from './types.js';
export type LearnNotifyHandler = (event: LearnNotifyEvent) => void | Promise<void>;
export type ClassifyEnqueueHandler = (payload: ClassifyEnqueuePayload) => void | Promise<void>;
export declare function resetLearnHandlersForTests(): void;
export declare function onLearnNotify(handler: LearnNotifyHandler): void;
export declare function onClassifyEnqueue(handler: ClassifyEnqueueHandler): void;
export declare function learnNotify(event: LearnNotifyEvent): Promise<void>;
export declare function enqueueClassify(payload: ClassifyEnqueuePayload): Promise<void>;
export declare function buildLearnEvent(ingest: IngestRecord, matchScore?: number): LearnNotifyEvent;
/** Ingest stub — does not write Dark Star production pages. */
export declare function ingestStub(opts: {
    title: string;
    fileName: string;
    sha256: string;
    provenance: IngestRecord['provenance'];
}): IngestRecord;
