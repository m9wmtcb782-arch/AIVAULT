import { matchMaterial, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from './match.js';
import {
  PublicSourceRegistry,
  builtinMohwCatalog,
  type AllowlistConfig,
  DEFAULT_ALLOWLIST,
} from './registry.js';
import { PublicMaterialFetcher } from './fetch.js';
import {
  buildLearnEvent,
  enqueueClassify,
  ingestStub,
  learnNotify,
} from './learn.js';
import type {
  MaterialListItem,
  MatchThresholds,
  MatchWeights,
  PipelineRunSummary,
  PipelineStepResult,
} from './types.js';

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

export class PublicLearnPipeline {
  private readonly registry: PublicSourceRegistry;
  private readonly fetcher: PublicMaterialFetcher;
  private readonly thresholds: MatchThresholds;
  private readonly weights: MatchWeights;
  private readonly offlineBytesByCatalogId: Record<string, Uint8Array>;

  constructor(opts: PipelineOptions = {}) {
    const allowlist = opts.allowlist ?? DEFAULT_ALLOWLIST;
    this.registry = opts.registry ?? new PublicSourceRegistry(allowlist);
    if (!opts.registry) {
      this.registry.registerMany(builtinMohwCatalog());
    }
    this.fetcher = opts.fetcher ?? new PublicMaterialFetcher(allowlist);
    this.thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
    this.weights = opts.weights ?? DEFAULT_WEIGHTS;
    this.offlineBytesByCatalogId = opts.offlineBytesByCatalogId ?? {};
  }

  getRegistry(): PublicSourceRegistry {
    return this.registry;
  }

  async runItem(item: MaterialListItem): Promise<PipelineStepResult> {
    // Reject credential-shaped fields if somehow passed via hints
    const banned = [...(item.hints ?? []), item.fileName ?? '', item.tronclassNameParam ?? '']
      .join(' ')
      .toLowerCase();
    if (/password\s*=|密碼|學號\s*[:=]/.test(banned) && /password|密碼/.test(banned)) {
      return {
        item,
        match: matchMaterial(item, [], this.thresholds, this.weights),
        classifyEnqueued: false,
        learnNotified: false,
        pendingReview: false,
        blockedReason: '拒絕：輸入疑似含密碼／憑證 — 本管線不接受帳密',
      };
    }

    const match = matchMaterial(item, this.registry.list(), this.thresholds, this.weights);

    if (match.decision === 'no_match') {
      return {
        item,
        match,
        classifyEnqueued: false,
        learnNotified: false,
        pendingReview: false,
        blockedReason: '無公開同源候選（可能僅存在於 TronClass，請手動下載後上傳）',
      };
    }

    if (match.decision === 'pending_review') {
      return {
        item,
        match,
        classifyEnqueued: false,
        learnNotified: false,
        pendingReview: true,
        blockedReason: '比對信心不足，待人工確認',
      };
    }

    const best = match.best!;
    const offline = this.offlineBytesByCatalogId[best.entry.id];
    const fetch = offline
      ? this.fetcher.fromBytes(best.entry, offline, best.score, best.reasons)
      : await this.fetcher.fetch(best.entry, best.score, best.reasons);

    if (!fetch.ok || !fetch.sha256) {
      return {
        item,
        match,
        fetch,
        classifyEnqueued: false,
        learnNotified: false,
        pendingReview: false,
        blockedReason: fetch.error ?? 'fetch failed',
      };
    }

    if (fetch.tronclassE2eSuccess !== false || fetch.provenance.tronclassE2eSuccess !== false) {
      throw new Error('invariant violated: tronclassE2eSuccess must be false');
    }

    const fileName =
      item.fileName ||
      item.tronclassNameParam ||
      `${best.entry.id}.pdf`;

    const ingest = ingestStub({
      title: best.entry.title,
      fileName,
      sha256: fetch.sha256,
      provenance: fetch.provenance,
    });

    await enqueueClassify({
      fileId: best.entry.id,
      fileName,
      courseId: '',
      courseCode: '',
      academicYear: '',
      semester: '',
      sha256: fetch.sha256,
      privatePath: ingest.privatePathHint,
      provenanceSource: 'public_source',
    });

    const learnEvent = buildLearnEvent(ingest, best.score);
    await learnNotify(learnEvent);

    return {
      item,
      match,
      fetch,
      ingest,
      classifyEnqueued: true,
      learnNotified: true,
      learnEvent,
      pendingReview: false,
    };
  }

  async runList(items: MaterialListItem[]): Promise<PipelineRunSummary> {
    const results: PipelineStepResult[] = [];
    let learnNotifyCallCount = 0;
    let publicSourceSuccessCount = 0;
    for (const item of items) {
      const r = await this.runItem(item);
      results.push(r);
      if (r.learnNotified) learnNotifyCallCount++;
      if (r.fetch?.publicSourceSuccess) publicSourceSuccessCount++;
    }
    return {
      results,
      learnNotifyCallCount,
      anyTronclassE2eSuccess: false,
      publicSourceSuccessCount,
    };
  }
}
