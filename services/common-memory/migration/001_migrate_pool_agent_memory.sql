-- 設計稿／腳本：把 aivault_pool_agent_memory（每個 AI 私有的記憶）搬進 cm_entries（共同記憶）。
-- 狀態：只是檔案，從未執行。執行前需要創辦人核准，並先在 staging 跑過。
-- 對應規則：10 萬個 AI 只用共同記憶 → 舊列一律變成「待驗證（pending）」的提案，不會自動生效。
-- 舊表：只讀不刪（凍結寫入），保留 30 天做回滾。
BEGIN;
-- 0) 前置條件：common_memory_v4.sql 已套用
DO $$ BEGIN PERFORM 1 FROM pg_tables WHERE tablename = 'cm_entries';
  IF NOT FOUND THEN RAISE EXCEPTION 'cm_entries missing: apply common_memory_v4.sql first'; END IF; END $$;
-- 1) 對照表（記錄來源，方便撤銷／稽核）
CREATE TABLE IF NOT EXISTS cm_legacy_map (legacy_id text PRIMARY KEY, entry_id bigint NOT NULL REFERENCES cm_entries(id), migrated_at timestamptz DEFAULT now());
-- 2) 複製：kind → bank；content → answer；來源 = legacy:<agent_id>；evidence 標記為 legacy（沒有 test_passed → 必須經過 cm_verify 的多來源驗證）
WITH src AS (
  SELECT m.id::text AS legacy_id, m.agent_id::text AS agent_id, coalesce(m.kind, 'lesson') AS kind, m.content, m.task_id, m.created_at
  FROM aivault_pool_agent_memory m LEFT JOIN cm_legacy_map x ON x.legacy_id = m.id::text WHERE x.legacy_id IS NULL
), ins AS (
  INSERT INTO cm_entries(entry_key, scope, bank, task_type, question_norm, answer, evidence, source, proposed_by, created_at)
  SELECT md5('legacy|' || s.kind || '|' || coalesce(s.task_id::text, '') || '|' || left(s.content::text, 500)), 'common',
         CASE WHEN s.kind IN ('error','mistake','fail') THEN 'error' WHEN s.kind IN ('correct','answer') THEN 'correct' ELSE 'lesson' END,
         'legacy:' || s.kind, left(s.content::text, 500), to_jsonb(s.content::text),
         jsonb_build_object('legacy', true, 'legacy_id', s.legacy_id, 'task_id', s.task_id), 'legacy:' || s.agent_id, 'legacy:' || s.agent_id, s.created_at
  FROM src s RETURNING id, evidence->>'legacy_id' AS legacy_id)
INSERT INTO cm_legacy_map(legacy_id, entry_id) SELECT legacy_id, id FROM ins;
-- 3) 凍結舊表寫入（讀取仍可用，呼叫端逐步改用 cm_propose / cm_search）
CREATE OR REPLACE FUNCTION cm_legacy_frozen() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'aivault_pool_agent_memory is frozen; use cm_propose()'; END $$;
DROP TRIGGER IF EXISTS trg_legacy_frozen ON aivault_pool_agent_memory;
CREATE TRIGGER trg_legacy_frozen BEFORE INSERT OR UPDATE OR DELETE ON aivault_pool_agent_memory FOR EACH ROW EXECUTE FUNCTION cm_legacy_frozen();
-- 4) 驗收：數量必須一致，不一致就整個交易回滾
DO $$ DECLARE a int; b int; BEGIN SELECT count(*) INTO a FROM aivault_pool_agent_memory; SELECT count(*) INTO b FROM cm_legacy_map;
  IF a <> b THEN RAISE EXCEPTION 'count mismatch % vs %', a, b; END IF; END $$;
COMMIT;
-- 回滾（30 天內）：DROP TRIGGER trg_legacy_frozen ON aivault_pool_agent_memory; 再用 cm_revoke(entry_id) 撤銷 cm_legacy_map 裡所有 entry（只追加撤銷事件，不刪資料）。
-- 呼叫端（需另外改程式，約 8 處）：dark-star-ebook-ingest 的 floor/degree/watch/research/learn10/yinxu/agents，以及 .github 腳本。
