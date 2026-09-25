# 給暗星的信：你要 GitHub 權限時，該怎麼開口、主人怎麼授權

暗星親啟：

你不是沒能力做電子書。你缺的是「寫進 GitHub 的鑰匙」。  
鑰匙不在程式碼裡。程式在 `m9wmtcb782-arch/AIVAULT`，不代表你能推檔。  
你不准自己發明 token、不准叫主人把密碼給你、不准把鑰匙寫進任何網頁或 commit。

主人會授權。你的工作是：**用下面這段話向主人要權，然後等鑰匙放到密鑰槽，再用鑰匙做事。**

——寫信人

---

## 一、你先自問（有鑰匙才動手）

執行前檢查環境裡有沒有：

- `ANXING_GITHUB_TOKEN` 或 `GITHUB_TOKEN`
- owner = `m9wmtcb782-arch`
- repo = `AIVAULT`

沒有 token：停止推檔。改為向主人唸「三、開口稿」。  
有 token：只推電子書成品到 `ebooks/`（或主人指定的目錄）。禁止推 token 本身。

---

## 二、你和主人的分工（背起來）

你做：

1. 說明要做什麼（例如：把文書做成電子書，寫進本庫 `ebooks/`）
2. 說明缺哪一種權限（Contents 寫入）
3. 用開口稿請主人授權
4. 拿到「已放入密鑰槽」的回覆後再推檔
5. 失敗就把 GitHub 回傳原文交給主人

主人做：

1. 在 GitHub 開 Fine-grained token，只勾本庫 AIVAULT
2. Contents 開 Read and write
3. 把 token 放進密鑰槽（Actions Secret 或後端 Vault），名稱 `ANXING_GITHUB_TOKEN`
4. 告訴你：「鑰匙已放好，去推 `ebooks/`」
5. 不把 token 全文唸給聊天室長期保存

---

## 三、開口稿（向主人原樣說）

請用這段，不要加長、不要改條件：

> 主人，我要把電子書寫進 GitHub 庫 `m9wmtcb782-arch/AIVAULT`，目錄 `ebooks/`。  
> 我現在沒有寫入鑰匙，所以不能推檔。  
> 請你開一張 Fine-grained token：只勾 AIVAULT，Contents 選 Read and write，到期 30 或 90 天。  
> 請把 token 放進密鑰槽，名稱用 `ANXING_GITHUB_TOKEN`。  
> 不要把 token 貼在對話或程式裡。  
> 放好後只回我：「鑰匙已放好，去推 ebooks/」。  
> 我收到這句才開始推檔。失敗會把 GitHub 的原文回報給你。

若你是 GitHub Actions 在跑，改唸：

> 主人，我是在本庫 Actions 執行。請把這個 workflow 的 permissions 設成 contents: write，並確認庫的 Actions 權限不是只讀。設好回我：「Actions 可寫，去推 ebooks/」。

---

## 四、主人授權時的最短步驟（你可唸給主人聽）

手機 Safari：

1. 登入 GitHub 帳號 `m9wmtcb782-arch`
2. 頭像 → Settings → 最底 Developer settings
3. Personal access tokens → Fine-grained tokens → Generate new token
4. Name：`anxing-aivault`；只選倉庫 **AIVAULT**
5. Contents：Read and write
6. Generate 後複製 token
7. 放到密鑰槽，名稱 `ANXING_GITHUB_TOKEN`
8. 回你：「鑰匙已放好，去推 ebooks/」

不要開 Administration、Secrets、Delete。

---

## 五、你收到「鑰匙已放好」之後

1. 用 token 讀 `m9wmtcb782-arch/AIVAULT`，確認連得上
2. 只新增或更新：`ebooks/書名.md`、`ebooks/書名.html`、`ebooks/提取說明.txt`（主人要才加 epub）
3. commit 訊息：`ebook: 書名`
4. 優先推分支 `ebooks`；主人沒說推 main，就不要推 main
5. 回報 commit 或 PR 網址
6. 401／403：停止，把錯誤原文給主人，再唸開口稿請他檢查勾庫與 Contents

---

## 六、禁令（違者停工）

- 不准在對話裡要求主人貼出 token 全文
- 不准把 token 寫進 HTML、JS、md、電子書
- 不准改推到別的 owner 或 repo
- 不准為了要權限重寫 AIVAULT
- 不准編造文書內容
- 沒有「鑰匙已放好」這句話，不准假裝已授權

完。
