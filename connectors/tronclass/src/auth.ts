/**
 * Auth interface — school-allowed credential handoff only.
 *
 * GATES:
 * - Do NOT enable auto-login until schoolAuthorizationConfirmed === true
 *   AND written school authorization is on file.
 * - Do NOT store plaintext student ID/password.
 * - Do NOT bypass captcha or login protection.
 * - Do NOT decode/renew expired TronClass download tokens.
 */

import type { AuthSessionHandoff, ConnectorConfig } from './types.js';

export class SchoolAuthGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchoolAuthGateError';
  }
}

export class SessionInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionInvalidError';
  }
}

/** Legacy name kept for sync.ts compatibility. */
export interface AuthProvider {
  acceptHandoff(handoff: AuthSessionHandoff): Promise<void>;
  hasSession(): boolean;
  revoke(): Promise<void>;
  /** Optional validity probe — returns false → pause + prompt re-login */
  isSessionValid?(): Promise<boolean>;
}

/**
 * Abstract session provider — browser handoff / school token placeholders.
 * Implementations MUST NOT accept password fields in committed config.
 */
export abstract class AuthSessionProvider implements AuthProvider {
  protected opaqueRef: string | null = null;
  protected revoked = false;
  protected expiresAt: Date | null = null;
  protected kind: AuthSessionHandoff['kind'] | null = null;
  /** UI pause flag when session invalid — sync must stop and prompt re-login */
  needsRelogin = false;

  constructor(protected readonly config: ConnectorConfig) {}

  assertGate(): void {
    if (!this.config.schoolAuthorizationConfirmed) {
      throw new SchoolAuthGateError(
        '學校授權未確認：禁止自動登入與背景抓取（schoolAuthorizationConfirmed=false）',
      );
    }
    if (this.config.auth.autoLoginEnabled) {
      throw new SchoolAuthGateError(
        'scaffold 禁止 autoLoginEnabled=true；僅允許學校允許的 token/session 交接',
      );
    }
    if (this.config.auth.plaintextPasswordStorage) {
      throw new SchoolAuthGateError('禁止明文密碼儲存');
    }
    if (this.config.auth.captchaBypass) {
      throw new SchoolAuthGateError('禁止繞過驗證碼');
    }
  }

  abstract readonly providerId: string;

  async acceptHandoff(handoff: AuthSessionHandoff): Promise<void> {
    this.assertGate();
    if (!handoff.opaqueCredentialRef || handoff.opaqueCredentialRef.length < 8) {
      throw new SchoolAuthGateError('缺少有效的 opaqueCredentialRef');
    }
    // Reject accidental password-shaped payloads
    const ref = handoff.opaqueCredentialRef;
    if (/password|passwd|學號|studentId/i.test(ref)) {
      throw new SchoolAuthGateError('opaqueCredentialRef 不得含密碼／學號字樣');
    }
    this.opaqueRef = ref;
    this.kind = handoff.kind;
    this.expiresAt = handoff.expiresAt ? new Date(handoff.expiresAt) : null;
    this.revoked = false;
    this.needsRelogin = false;
  }

  hasSession(): boolean {
    return Boolean(this.opaqueRef) && !this.revoked;
  }

  async isSessionValid(): Promise<boolean> {
    if (!this.hasSession()) {
      this.needsRelogin = true;
      return false;
    }
    if (this.expiresAt && Date.now() > this.expiresAt.getTime()) {
      this.needsRelogin = true;
      this.opaqueRef = null;
      return false;
    }
    return true;
  }

  /**
   * Called when platform returns 401/403 — pause sync, clear session, prompt re-login.
   * Does NOT attempt token refresh / decode of expired media URLs.
   */
  async markInvalid(reason: string): Promise<void> {
    this.needsRelogin = true;
    this.opaqueRef = null;
    this.revoked = true;
    void reason;
  }

  async revoke(): Promise<void> {
    this.opaqueRef = null;
    this.revoked = true;
    this.needsRelogin = false;
    this.expiresAt = null;
  }
}

/** User logs in on official TronClass page; opaque session ref handed to connector. */
export class BrowserHandoffAuthProvider extends AuthSessionProvider {
  readonly providerId = 'browser_handoff';
}

/** School-issued API/token placeholder — shape TBD after written authorization. */
export class SchoolTokenAuthProvider extends AuthSessionProvider {
  readonly providerId = 'school_token';
}

/** Default stub used by scaffold. */
export class StubAuthProvider extends AuthSessionProvider {
  readonly providerId = 'stub_opaque';
}

export function createAuthSessionProvider(
  config: ConnectorConfig,
): AuthSessionProvider {
  switch (config.auth.mode) {
    case 'browser_handoff':
      return new BrowserHandoffAuthProvider(config);
    case 'school_allowed_token_or_session_handoff':
      return new SchoolTokenAuthProvider(config);
    default:
      return new StubAuthProvider(config);
  }
}

export function rejectPasswordLogin(_username: string, _password: string): never {
  throw new SchoolAuthGateError(
    '拒絕學號/密碼登入 API：本 connector 不實作、不儲存明文密碼登入',
  );
}

/** Explicitly refuse captcha OCR / auto-login helpers (e.g. community tronclass-api). */
export function rejectCaptchaOcr(): never {
  throw new SchoolAuthGateError(
    '拒絕驗證碼 OCR／自動登入：不得引入 tronclass-api 或同類繞過',
  );
}
