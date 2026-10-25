/**
 * Auth interface — school-allowed credential handoff only.
 *
 * GATES:
 * - Do NOT enable auto-login until schoolAuthorizationConfirmed === true
 *   AND written school authorization is on file.
 * - Do NOT store plaintext student ID/password.
 * - Do NOT bypass captcha or login protection.
 */

import type { AuthSessionHandoff, ConnectorConfig } from './types.ts';

export class SchoolAuthGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchoolAuthGateError';
  }
}

export interface AuthProvider {
  acceptHandoff(handoff: AuthSessionHandoff): Promise<void>;
  hasSession(): boolean;
  revoke(): Promise<void>;
}

export class StubAuthProvider implements AuthProvider {
  #opaqueRef: string | null = null;
  #revoked = false;

  constructor(private readonly config: ConnectorConfig) {}

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

  async acceptHandoff(handoff: AuthSessionHandoff): Promise<void> {
    this.assertGate();
    if (!handoff.opaqueCredentialRef || handoff.opaqueCredentialRef.length < 8) {
      throw new SchoolAuthGateError('缺少有效的 opaqueCredentialRef');
    }
    this.#opaqueRef = handoff.opaqueCredentialRef;
    this.#revoked = false;
  }

  hasSession(): boolean {
    return Boolean(this.#opaqueRef) && !this.#revoked;
  }

  async revoke(): Promise<void> {
    this.#opaqueRef = null;
    this.#revoked = true;
  }
}

export function rejectPasswordLogin(_username: string, _password: string): never {
  throw new SchoolAuthGateError(
    '拒絕學號/密碼登入 API：本 connector 不實作、不儲存明文密碼登入',
  );
}
