/**
 * Shared types for the isolated TronClass connector (scaffold only).
 * Dynamic semester/course model. No live credentials.
 */

export type AuthMode =
  | 'disabled'
  | 'school_allowed_token_or_session_handoff'
  | 'browser_handoff'
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
    /** Runtime MUST keep this true — permanent fixed course lists are forbidden */
    fixedCourseListForbidden: boolean;
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
  /** Optional course display name for private path layout */
  courseTitle?: string;
}

export interface DedupKey {
  fileId: string;
  updatedAt: string;
  sha256: string;
}

/** Provenance — who/where/when the file came from (private shelf metadata). */
export interface MaterialProvenance {
  school: string;
  source: 'tronclass' | 'public_source' | 'manual';
  sourceSystem: string;
  courseId: string;
  courseCode: string;
  courseTitle?: string;
  academicYear: string;
  semester: string;
  sourceFileId: string;
  retrievedAt: string;
  /** Never true for public-source retrieval */
  tronclassE2eSuccess: false | boolean;
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
  provenance?: MaterialProvenance;
}

export interface SyncLogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  courseId?: string;
  courseCode?: string;
  fileId?: string;
  attempt?: number;
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

/**
 * Opaque session handoff — NO student ID / password fields.
 * opaqueCredentialRef points at vault/secret store outside git.
 */
export interface AuthSessionHandoff {
  kind: 'browser_handoff' | 'school_token' | 'opaque';
  opaqueCredentialRef: string;
  expiresAt?: string;
  /** Optional label for UI (never a secret) */
  sessionLabel?: string;
}

export interface CourseDiff {
  added: DiscoveredCourse[];
  unchanged: DiscoveredCourse[];
  removedOrInactive: CourseRecord[];
}

/** Sync run outcome flags — public success MUST NOT set tronclassE2eSuccess. */
export interface SyncRunResult {
  ok: boolean;
  storedCount: number;
  skippedDedup: number;
  errors: string[];
  /** Only true after real authorized TronClass one-course-one-file E2E */
  tronclassE2eSuccess: false;
  /** True when a PublicSourceAdapter retrieved something (separate channel) */
  publicSourceSuccess: boolean;
  stopped: boolean;
  sessionInvalid: boolean;
}
