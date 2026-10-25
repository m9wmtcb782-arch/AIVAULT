/**
 * TronClass Connector — shared types (scaffold only).
 * Dynamic semester/course model. No live credentials.
 */

export type AuthMode =
  | 'disabled'
  | 'school_allowed_token_or_session_handoff'
  | 'oauth'
  | 'unknown';

/** Academic term identity — isolates storage and indexes across terms. */
export interface AcademicTerm {
  academicYear: string; // e.g. "114"
  semester: string; // e.g. "1" | "2" | "summer"
}

export interface DiscoveredCourse extends AcademicTerm {
  courseId: string;
  courseCode: string;
  title?: string;
  /** Platform enrollment / access flag when known */
  accessAuthorized: boolean;
}

export interface CourseRecord extends DiscoveredCourse {
  provisionedAt: string;
  privateStoragePath: string;
  indexId: string;
  syncEnabled: boolean;
}

export interface ConnectorConfig {
  schoolAuthorizationConfirmed: boolean;
  baseUrl: string;
  mediaBaseUrl?: string;
  pollIntervalHours: number;
  courseDiscovery: {
    mode: 'dynamic';
    fixedCourseListForbidden: true;
    compareFields: string[];
    autoProvisionNewCourses: boolean;
    retainHistoricalMaterials: boolean;
  };
  /** Always empty in example — discovery fills DB, not a permanent allowlist */
  courses: [];
  allowlistExtensions: string[];
  privateStorageRoot: string;
  storageLayout: string;
  maxRetries: number;
  retryBackoffMs: number;
  auth: {
    mode: AuthMode;
    plaintextPasswordStorage: false;
    captchaBypass: false;
    autoLoginEnabled: false;
  };
  scheduler: {
    enabled: false | boolean;
    requiresEnv: string;
    kind: string;
    note?: string;
  };
  darkStarNotify: {
    enabled: boolean;
    hook: 'event_stub_only' | string;
  };
}

export interface MaterialMeta {
  fileId: string;
  courseId: string;
  courseCode: string;
  academicYear: string;
  semester: string;
  fileName: string;
  updatedAt: string;
  downloadAllowed: boolean;
  downloadUrl?: string;
  contentType?: string;
}

export interface DedupKey {
  fileId: string;
  updatedAt: string;
  sha256: string;
}

export interface StoredFileRecord {
  courseId: string;
  courseCode: string;
  academicYear: string;
  semester: string;
  fileId: string;
  fileName: string;
  updatedAt: string;
  sha256: string;
  privatePath: string;
  storedAt: string;
}

export interface SyncLogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  courseId?: string;
  courseCode?: string;
  fileId?: string;
}

export interface DarkStarNotifyEvent {
  type: 'tronclass.materials.indexed';
  academicYear: string;
  semester: string;
  courseId: string;
  courseCode: string;
  fileId: string;
  sha256: string;
  privatePath: string;
  sourceLabel: string;
}

export interface AuthSessionHandoff {
  opaqueCredentialRef: string;
  expiresAt?: string;
}

export interface CourseDiff {
  added: DiscoveredCourse[];
  unchanged: DiscoveredCourse[];
  removedOrInactive: CourseRecord[];
}
