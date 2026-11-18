# 美國法典第26編（IRC）全文，release point 119-142

- 來源：OLRC 官方 `xml_usc26@119-142.zip`（uscode.house.gov），sha256 見 manifest.json；公共領域（17 U.S.C. §105）
- 轉檔：`convert_uslm_to_pages.py`（USLM XML → 條文文字，含款目、表格、Source Credit、註腳；不含編輯附註）→ `paginate_volumes.py`（每頁 ≤900 字，依 Subtitle/Chapter/Subchapter/Part 邊界分 11 冊）
- 條數：2,162 條次（現行 1,900／廢止 241／重編號 17／保留 2／省略 2），與官方 PDF 版條次標題核對一致
- 第1冊沿用原空殼 ebook_id `eabac26d-1725-4284-a754-871f72910fdc`；第2–11冊 id 見 manifest.json
- 匯入：`.github/workflows/usc26-import-20261118.yml`（僅本分支 push 觸發；先備份；每冊寫完以 md5 驗證後才設定頁數上架）
