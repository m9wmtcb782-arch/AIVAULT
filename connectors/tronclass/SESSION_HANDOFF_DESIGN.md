# Session Handoff 設計（使用者官方頁自行登入）

> **授權狀態（2026-10-25，Asia/Taipei）：`SCHOOL_AUTH_CONFIRMED=false`（未確認）** — 目前尚未取得東吳／智園對自動化唯讀存取的明確許可，故預設關閉（非因使用者撤銷）。真實同步、自動登入、背景抓取**一律停用**；真實一課一檔 E2E 維持 **BLOCKED**。僅續做離線骨架／mock。不收集學號密碼。須取得學校書面授權證據後才可重新評估。


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

---

## 附錄：能否為 AIVAULT 另設一組 TronClass 帳號密碼？（使用者提問 2026-10-25）

**結論：不行，也不應該。**

1. **身分來源**：東吳 TronClass（https://tronclass.scu.edu.tw/）以學校身分登入——學生用**學號**、教職員用**人事代碼**，搭配**電子化校園密碼**（SSO 式單一身分）。學生一般**無法**為 AIVAULT 另外註冊一個獨立的 TronClass 帳號。
2. **禁止事項**：建立假帳號、共用帳號、借用他人憑證，或任何繞過「本人登入」的作法，一律禁止；亦不得繞過驗證碼或登入保護。
3. **支援路徑（須待學校允許自動化／唯讀同步，即 `SCHOOL_AUTH_CONFIRMED` 之後）**：
   - 使用者**本人**於官方 https://tronclass.scu.edu.tw/ 登入。
   - AIVAULT 僅使用**短效、經授權的 session handoff**（瀏覽器 cookie／session 匯出，必須由使用者主動操作）。
   - **絕不**在 GitHub／repo 存放明文密碼；若真的要保存憑證，只能放在 repo 以外的使用者私人保管庫（vault），且在 `SCHOOL_AUTH_CONFIRMED` 前**不得**用於自動登入，任何時候都不得用於繞過驗證碼。
   - 同步為**唯讀**；session 過期即**暫停**並提示使用者重新登入，不續命過期 token。
4. **未來選項（優先）**：若學校日後為學生核發**專屬 API token 或 service account**，這是首選的非密碼機制，Connector 將改走該授權並可撤銷。
5. **公開來源 ≠ TronClass 同步**：衛福部（MOHW）公開 PDF 屬 PublicSource，從公開網址取得；不代表 TronClass 同步成功，也不計入 TronClass E2E。

---

## 附錄二：「在 AIVAULT 設好 TronClass 帳號密碼，就有權限了？」（2026-10-25）

**結論：不會。存了帳密 ≠ 學校允許自動同步。**

1. **權限的定義**：權限 = **學校政策允許自動化／唯讀存取**（`SCHOOL_AUTH_CONFIRMED`）＋ **使用者本人於官方頁登入後的有效 session**。兩者缺一不可；把學號／密碼放進 AIVAULT 或 GitHub，兩者都不會因此成立。
2. **禁止事項**：
   - 明文學號／密碼寫入 repo（任何檔案、`.env`、config）並 commit 到 git。
   - 出現在 GitHub Pages、Issue／PR 留言、commit 訊息、log 或聊天紀錄。
3. **可選的未來路徑**：使用者私人保管庫（vault，**位於 repo 之外**）僅作「個人登入輔助」；仍受 `SCHOOL_AUTH_CONFIRMED` 閘控，未確認前不得自動登入；**任何時候都不得繞過驗證碼或登入保護**。
4. **目前狀態**：真實同步仍 BLOCKED；不收集密碼、不做 live login。
