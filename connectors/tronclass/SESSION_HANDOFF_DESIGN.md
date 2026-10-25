# Session Handoff 設計（使用者官方頁自行登入）

狀態：**設計文件** — 實作受 `SCHOOL_AUTH_CONFIRMED`／`schoolAuthorizationConfirmed` 雙閘。  
禁止：學號／密碼寫入 GitHub、自動登入、CAPTCHA OCR、解碼／續命過期媒體 token。

## 原則

1. 使用者在**東吳官方 TronClass 登入頁**自行完成帳密／SSO／驗證碼。  
2. 僅在學校書面允許「有效授權 session 下唯讀同步」時，才把**不透明** session／token 參考交給 connector。  
3. Connector 只持有 `opaqueCredentialRef`（指向 vault／OS keychain／CI secret），**不**持有明文密碼。  
4. Session 失效（過期、401／403）→ **暫停同步** → 提示使用者回官方頁重新登入 → 重新 handoff。  
5. **不**自動刷新、**不**解析 `tcmedia` 簽名 URL 的 token／nonce／timestamp 以續命。

## 流程

```
使用者 → 官方登入頁（tronclass.scu.edu.tw）
       → 瀏覽器／OS 安全儲存取得 session cookie 或學校核發 token
       → AuthSessionHandoff { kind, opaqueCredentialRef, expiresAt? }
       → BrowserHandoffAuthProvider / SchoolTokenAuthProvider.acceptHandoff()
       → SyncEngine.runOnce()（需 schoolAuthorizationConfirmed=true）
       → 若 isSessionValid()==false 或 SessionInvalidError
            → markInvalid() → needsRelogin=true → stop → UI 提示重登
```

## AuthSessionHandoff 形狀

```ts
{
  kind: 'browser_handoff' | 'school_token' | 'opaque',
  opaqueCredentialRef: string, // vault key id — NOT password
  expiresAt?: string,          // ISO8601
  sessionLabel?: string        // non-secret UI label
}
```

設定檔（`config.example.json`）**不得**出現 `username`／`password`／`studentId` 欄位。

## 學校政策閘門

| 閘門 | 位置 | 未通過時 |
|------|------|----------|
| `schoolAuthorizationConfirmed` | connector config | 拋 `SchoolAuthGateError`；不發網 |
| `SCHOOL_AUTH_CONFIRMED=true` | GitHub Actions secret | gated workflow no-op |
| 有效 session | `AuthSessionProvider.isSessionValid()` | 暫停 + 提示重登 |

未取得東吳電算／智園書面允許前，上述閘門保持關閉；本設計僅描述允許後的接線方式。

## 與公開來源的分離

- `PublicSourceAdapter`：抓衛福部等**公開** PDF；`publicSourceSuccess` 可為 true。  
- `TronClassClient`：僅私有課件通道；`SyncRunResult.tronclassE2eSuccess` 僅在真實授權 E2E 後由人工／專用 harness 標記。  
- **禁止**將公開來源成功寫成 TronClass E2E 成功。

## 撤銷

- `revokeAuth()`／`SyncEngine.revokeAuthorization()`：清除本地 opaque ref。  
- 不呼叫 TronClass 突變 API；不修改平台任何資料。
