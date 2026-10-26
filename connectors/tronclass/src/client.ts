/**
 * TronClass HTTP client stubs — UNKNOWN endpoints until school-authorized discovery.
 *
 * Official public API docs for student material list/download: NOT FOUND (2026-10-25 research).
 * Do NOT invent or hard-code unofficial scrape paths as production contracts.
 * READ-ONLY: never POST/PUT/PATCH/DELETE that mutate TronClass course data.
 *
 * Kind marker: TRONCLASS_CLIENT_KIND — distinct from PublicSourceAdapter.
 */

import type { AuthProvider } from './auth.js';
import { SchoolAuthGateError, SessionInvalidError } from './auth.js';
import { TRONCLASS_CLIENT_KIND } from './public-source.js';
import type { ConnectorConfig, DiscoveredCourse, MaterialMeta } from './types.js';

export class TronClassClient {
  readonly kind = TRONCLASS_CLIENT_KIND;

  constructor(
    protected readonly config: ConnectorConfig,
    protected readonly auth: AuthProvider,
  ) {}

  protected assertAuthorized(): void {
    if (!this.config.schoolAuthorizationConfirmed) {
      throw new SchoolAuthGateError(
        '學校授權未確認：client 禁止對 TronClass 發請求',
      );
    }
    if (!this.auth.hasSession()) {
      throw new SessionInvalidError('無有效授權 session／token handoff — 請於官方頁重新登入');
    }
  }

  /**
   * TODO(school-auth): Discover official or school-approved course-list endpoint.
   * Unofficial community reports mention paths like GET /api/my-courses — NOT verified
   * for SCU and NOT a contract until school allows automated access.
   */
  async listCourses(): Promise<DiscoveredCourse[]> {
    this.assertAuthorized();
    throw new Error(
      'TODO: listCourses — endpoint UNKNOWN pending school-authorized API discovery',
    );
  }

  /**
   * TODO(school-auth): List downloadable materials for one course.
   * Must respect teacher download-allowed flags only.
   */
  async listMaterials(_courseId: string): Promise<MaterialMeta[]> {
    this.assertAuthorized();
    throw new Error(
      'TODO: listMaterials — endpoint UNKNOWN pending school-authorized API discovery',
    );
  }

  /**
   * TODO(school-auth): Download bytes for an already-authorized material URL.
   * SCU media host observed publicly: tcmedia.scu.edu.tw (signed URL pattern undocumented officially).
   * READ-ONLY GET only. Do NOT decode/renew expired tokens.
   */
  async downloadMaterial(_meta: MaterialMeta): Promise<Uint8Array> {
    this.assertAuthorized();
    if (!_meta.downloadAllowed) {
      throw new SchoolAuthGateError('教材未允許下載，略過');
    }
    throw new Error(
      'TODO: downloadMaterial — not implemented; no live download until school auth + E2E',
    );
  }
}

/**
 * Offline mock client for unit tests — NEVER hits the network.
 * Inject into SyncEngine in tests only.
 */
export class MockTronClassClient extends TronClassClient {
  courses: DiscoveredCourse[] = [];
  materialsByCourse = new Map<string, MaterialMeta[]>();
  blobs = new Map<string, Uint8Array>();
  failDownloads = new Set<string>();

  override async listCourses(): Promise<DiscoveredCourse[]> {
    this.assertAuthorized();
    return [...this.courses];
  }

  override async listMaterials(courseId: string): Promise<MaterialMeta[]> {
    this.assertAuthorized();
    return [...(this.materialsByCourse.get(courseId) ?? [])];
  }

  override async downloadMaterial(meta: MaterialMeta): Promise<Uint8Array> {
    this.assertAuthorized();
    if (!meta.downloadAllowed) {
      throw new SchoolAuthGateError('教材未允許下載，略過');
    }
    if (this.failDownloads.has(meta.fileId)) {
      throw new Error(`mock download fail: ${meta.fileId}`);
    }
    const blob = this.blobs.get(meta.fileId);
    if (!blob) throw new Error(`mock missing blob: ${meta.fileId}`);
    return blob;
  }
}
