/**
 * TronClass HTTP client stubs — UNKNOWN endpoints until school-authorized discovery.
 *
 * Official public API docs for student material list/download: NOT FOUND (2026-10-25 research).
 * Do NOT invent or hard-code unofficial scrape paths as production contracts.
 * READ-ONLY: never POST/PUT/PATCH/DELETE that mutate TronClass course data.
 */

import type { AuthProvider } from './auth.ts';
import { SchoolAuthGateError } from './auth.ts';
import type { ConnectorConfig, DiscoveredCourse, MaterialMeta } from './types.ts';

export class TronClassClient {
  constructor(
    private readonly config: ConnectorConfig,
    private readonly auth: AuthProvider,
  ) {}

  private assertAuthorized(): void {
    if (!this.config.schoolAuthorizationConfirmed) {
      throw new SchoolAuthGateError(
        '學校授權未確認：client 禁止對 TronClass 發請求',
      );
    }
    if (!this.auth.hasSession()) {
      throw new SchoolAuthGateError('無有效授權 session／token handoff');
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
   * READ-ONLY GET only.
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
