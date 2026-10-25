import { PublicSourceRegistry, type AllowlistConfig } from './registry.js';
import { PublicMaterialFetcher } from './fetch.js';
import type { MaterialListItem, MatchThresholds, MatchWeights, PipelineRunSummary, PipelineStepResult } from './types.js';
export interface PipelineOptions {
    registry?: PublicSourceRegistry;
    fetcher?: PublicMaterialFetcher;
    thresholds?: MatchThresholds;
    weights?: MatchWeights;
    allowlist?: AllowlistConfig;
    /**
     * When true (default for offline tests), use fetcher.fromBytes with fixture bytes
     * instead of HTTP — even if a URL is present.
     */
    offlineBytesByCatalogId?: Record<string, Uint8Array>;
}
export declare class PublicLearnPipeline {
    private readonly registry;
    private readonly fetcher;
    private readonly thresholds;
    private readonly weights;
    private readonly offlineBytesByCatalogId;
    constructor(opts?: PipelineOptions);
    getRegistry(): PublicSourceRegistry;
    runItem(item: MaterialListItem): Promise<PipelineStepResult>;
    runList(items: MaterialListItem[]): Promise<PipelineRunSummary>;
}
