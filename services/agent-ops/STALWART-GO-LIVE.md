# Stalwart 上線步驟（尚未執行；每一步都需要開創者授權）
目前狀態：Stalwart v1.0.1 只在工作機上執行，只綁定 127.0.0.1（2525/2587/2143/2080），不對外開放。網域 aivault.net.eu.org 尚未委派。**真實郵箱數 = 0。**

1. **主機**：Oracle Cloud Always Free VM，Ampere A1，建議 2–4 OCPU、12–24 GB RAM、200 GB 開機碟。需開創者本人註冊 Oracle 帳號，並用信用卡做身分驗證（不扣款）。
2. **25 埠**：OCI 預設封鎖對外 25 埠。要開工單申請解封（需要有付費帳號歷史，可能被拒）。被拒時改用 SMTP relay 外寄（免費額度很小，例如 Brevo 約 300 封/日，需核實；需另外註冊）。收信（入站 25）通常可以使用。
3. **防火牆**（Security List 和 iptables 都要開）：25（入站 MTA）、465（SMTPS 提交）、587（提交）、993（IMAPS）、443（WebUI 與 ACME 憑證）。8080 只在設定期間開，限定開創者 IP，用完關閉。
4. **PTR**：OCI 的 IP 不能自訂反解，這會影響送達率。若有需要，改用 relay 外寄。
5. **安裝**：`install.sh` 或 binary 安裝；完成 bootstrap（hostname mail.aivault.net.eu.org、domain aivault.net.eu.org、開啟 ACME 與 DKIM）。
6. **DNS**（Cloudflare，委派核准後）：
   - `mail A <VM_IP>`（DNS only）
   - `@ MX 10 mail.aivault.net.eu.org.`
   - `@ TXT "v=spf1 mx -all"`（改用 relay 時要加入 relay 的 include）
   - DKIM：照 Stalwart zone 檔的 selector TXT 加入
   - `_dmarc TXT "v=DMARC1; p=none; rua=mailto:dmarc@aivault.net.eu.org"`
   - mta-sts、autoconfig、autodiscover 的 CNAME
   - CAA 加 letsencrypt.org
   - 加入時要同時移除先前的「拒信」SPF/DMARC/DKIM 空記錄。
7. **後端**：`STALWART_ADMIN` 改用權限最小的 API key（只給 sysAccountCreate/Get/Query），放在 Supabase Secrets；provisioner 只在後端執行。
8. **驗收**：Worker-001 從外部真實信箱收信、讀信、回信，並在外部信箱查看 SPF/DKIM/DMARC 結果為 pass。通過後才把 mailboxes.status 設為 VERIFIED。
9. **分批**：每批 1,000 個帳號，觀察後再擴大；配額預設 256 MB 太大，建議 10–50 MB；每個帳號每日寄信上限 20 封；有投訴就自動暫停寄信。
