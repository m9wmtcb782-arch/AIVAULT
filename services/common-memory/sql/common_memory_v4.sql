-- AIVAULT 共同記憶 v4（強化版）。ADDITIVE ONLY，NOT APPLIED — 需開創者批准。需要 pgvector。
-- 身分全部來自 JWT（不再信任函式參數）：
--   service_role → 暗星（後端暗星函式）；authenticated 且 app_metadata.app_role ∈ {worker, founder} → 該角色；actor id = JWT sub。
-- 規則：10 萬 AI 只用共同記憶；只有暗星有私有記憶。共同記憶：提案 → 驗證（多來源/測試、不可自驗）→ 生效；可隔離、可撤銷（連鎖撤銷衍生物）；全部 append-only。
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE OR REPLACE FUNCTION public.cm_claims() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
CREATE OR REPLACE FUNCTION public.cm_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN public.cm_claims()->>'role' = 'service_role' THEN 'darkstar'
              WHEN public.cm_claims()->'app_metadata'->>'app_role' IN ('worker','founder') THEN public.cm_claims()->'app_metadata'->>'app_role'
              ELSE 'none' END $$;
CREATE OR REPLACE FUNCTION public.cm_actor() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN public.cm_role() = 'darkstar' THEN 'darkstar' ELSE coalesce(public.cm_claims()->>'sub', 'anonymous') END $$;

CREATE TABLE IF NOT EXISTS public.cm_config (k text PRIMARY KEY, v numeric NOT NULL);
INSERT INTO public.cm_config VALUES ('rate_per_hour', 20), ('min_sources', 2), ('anomaly_window', 50), ('anomaly_revoked_ratio', 0.3), ('half_life_days', 30), ('w_place_mismatch', 0.8), ('w_people_mismatch', 0.9)
  ON CONFLICT (k) DO NOTHING;
CREATE OR REPLACE FUNCTION public.cm_cfg(p text) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT v FROM public.cm_config WHERE k = p $$;

CREATE TABLE IF NOT EXISTS public.cm_entries (
  id bigserial PRIMARY KEY,
  entry_key text NOT NULL,                  -- 去重鍵 md5(scope|bank|modality|task|signature|question)
  version int NOT NULL DEFAULT 1,
  supersedes bigint REFERENCES public.cm_entries(id),
  scope text NOT NULL CHECK (scope IN ('common','darkstar_private')),
  bank text NOT NULL CHECK (bank IN ('correct','error','lesson')),
  modality text NOT NULL DEFAULT 'text' CHECK (modality IN ('text','voice','image','video','short_video','3d','music')),
  task_type text NOT NULL, signature text, question_norm text,
  answer jsonb, context jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 天時地利人和：{"at":..,"district":..,"model":..}
  embedding vector(384), asset_ref text,                       -- 多模態資產另存 cm_assets
  evidence jsonb NOT NULL, source text NOT NULL,                -- 來源（模型/測試/人），用於多來源驗證
  proposed_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS cm_entries_key ON public.cm_entries (entry_key, version DESC);
CREATE INDEX IF NOT EXISTS cm_entries_task ON public.cm_entries (task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS cm_entries_by ON public.cm_entries (proposed_by, created_at DESC);
-- 狀態事件（append-only）：verify / corroborate / quarantine / conflict / release / revoke / cascade_revoke
CREATE TABLE IF NOT EXISTS public.cm_events (id bigserial PRIMARY KEY, entry_id bigint NOT NULL REFERENCES public.cm_entries(id), kind text NOT NULL
  CHECK (kind IN ('verify','corroborate','quarantine','conflict','release','revoke','cascade_revoke')), actor text NOT NULL, reason text, data jsonb NOT NULL DEFAULT '{}'::jsonb, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS cm_events_entry ON public.cm_events (entry_id, at);
-- 來源鏈（provenance）：教訓、轉接器訓練資料列、其他條目從哪些條目衍生
CREATE TABLE IF NOT EXISTS public.cm_derivations (child_kind text NOT NULL CHECK (child_kind IN ('entry','lesson','adapter_row')), child_id text NOT NULL, parent_entry bigint NOT NULL REFERENCES public.cm_entries(id), PRIMARY KEY (child_kind, child_id, parent_entry));
CREATE INDEX IF NOT EXISTS cm_derivations_parent ON public.cm_derivations (parent_entry);
-- 多模態資產（介面先定；嵌入維度依模型而定）
CREATE TABLE IF NOT EXISTS public.cm_assets (id bigserial PRIMARY KEY, entry_id bigint REFERENCES public.cm_entries(id), modality text NOT NULL, uri text NOT NULL, sha256 text NOT NULL,
  emb_text vector(384), emb_image vector(512), emb_audio vector(512), emb_video vector(512), meta jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION public.cm_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'common memory is append-only'; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['cm_entries','cm_events','cm_derivations','cm_assets'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS %1$s_no_mutate ON public.%1$s; CREATE TRIGGER %1$s_no_mutate BEFORE UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.cm_append_only()', t);
  EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON public.%s FROM PUBLIC, anon', t);
  EXECUTE format('GRANT SELECT ON public.%s TO authenticated', t); EXECUTE format('GRANT SELECT ON public.%s TO service_role', t); END LOOP; END $$;
ALTER TABLE public.cm_config ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.cm_config FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS cm_read ON public.cm_entries;
CREATE POLICY cm_read ON public.cm_entries FOR SELECT TO authenticated USING ((scope = 'common' AND public.cm_role() IN ('worker','founder','darkstar')) OR (scope = 'darkstar_private' AND public.cm_role() IN ('darkstar','founder')));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['cm_events','cm_derivations','cm_assets'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS %1$s_read ON public.%1$s', t);
  EXECUTE format('CREATE POLICY %1$s_read ON public.%1$s FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.cm_entries e WHERE e.id = %2$s))', t, CASE t WHEN 'cm_derivations' THEN 'parent_entry' ELSE 'entry_id' END); END LOOP; END $$;

-- 狀態：revoked > quarantined（隔離/衝突且未解除）> active（已驗證）> pending
CREATE OR REPLACE VIEW public.cm_status WITH (security_invoker = true) AS
SELECT e.id AS entry_id,
  CASE WHEN EXISTS (SELECT 1 FROM public.cm_events v WHERE v.entry_id = e.id AND v.kind IN ('revoke','cascade_revoke')) THEN 'revoked'
       WHEN EXISTS (SELECT 1 FROM public.cm_events q WHERE q.entry_id = e.id AND q.kind IN ('quarantine','conflict')
                    AND NOT EXISTS (SELECT 1 FROM public.cm_events r WHERE r.entry_id = e.id AND r.kind = 'release' AND r.at >= q.at)) THEN 'quarantined'
       WHEN EXISTS (SELECT 1 FROM public.cm_events v WHERE v.entry_id = e.id AND v.kind = 'verify') THEN 'active' ELSE 'pending' END AS state,
  (SELECT count(DISTINCT s) FROM (SELECT e.source AS s UNION SELECT c.data->>'source' FROM public.cm_events c WHERE c.entry_id = e.id AND c.kind = 'corroborate') x) AS sources
FROM public.cm_entries e;
CREATE OR REPLACE VIEW public.cm_active WITH (security_invoker = true) AS
  SELECT e.*, s.sources FROM public.cm_entries e JOIN public.cm_status s ON s.entry_id = e.id WHERE s.state = 'active';
-- 轉接器訓練資料：只收「所有祖先都仍有效」的列；撤銷任何祖先 → 自動失效
CREATE OR REPLACE VIEW public.cm_training_rows_valid WITH (security_invoker = true) AS
  SELECT d.child_id AS row_id, array_agg(d.parent_entry) AS parents FROM public.cm_derivations d WHERE d.child_kind = 'adapter_row'
  GROUP BY d.child_id HAVING bool_and(EXISTS (SELECT 1 FROM public.cm_status s WHERE s.entry_id = d.parent_entry AND s.state = 'active'));
GRANT SELECT ON public.cm_status, public.cm_active, public.cm_training_rows_valid TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cm_propose(p_scope text, p_bank text, p_modality text, p_task text, p_sig text, p_q text, p_answer jsonb, p_context jsonb,
  p_embedding vector, p_evidence jsonb, p_source text, p_derived_from bigint[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := cm_role(); a text := cm_actor(); k text; ex record; v bigint; n int; bad numeric; tot int; ver int := 1; sup bigint; st text := 'pending';
BEGIN
  IF r NOT IN ('worker','darkstar','founder') THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_scope = 'darkstar_private' AND r <> 'darkstar' THEN RAISE EXCEPTION 'PRIVATE_SCOPE_DARKSTAR_ONLY'; END IF;
  IF p_evidence IS NULL OR NOT (p_evidence ? 'test_passed' OR p_evidence ? 'agreement') THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED'; END IF;
  IF coalesce(p_source,'') = '' THEN RAISE EXCEPTION 'SOURCE_REQUIRED'; END IF;
  -- 每位提案者速率限制（暗星除外）
  IF r <> 'darkstar' THEN SELECT count(*) INTO n FROM cm_entries WHERE proposed_by = a AND created_at > now() - interval '1 hour';
    IF n >= cm_cfg('rate_per_hour') THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF; END IF;
  k := md5(concat_ws('|', p_scope, p_bank, coalesce(p_modality,'text'), p_task, coalesce(p_sig,''), coalesce(p_q,'')));
  SELECT e.id, e.answer, e.version INTO ex FROM cm_entries e JOIN cm_status s ON s.entry_id = e.id WHERE e.entry_key = k AND s.state IN ('active','pending') ORDER BY e.version DESC LIMIT 1;
  IF ex.id IS NOT NULL AND ex.answer IS NOT DISTINCT FROM p_answer THEN   -- 去重：同答案 → 只記一筆佐證來源
    INSERT INTO cm_events(entry_id, kind, actor, data) VALUES (ex.id, 'corroborate', a, jsonb_build_object('source', p_source, 'evidence', p_evidence));
    RETURN jsonb_build_object('id', ex.id, 'dedup', true); END IF;
  IF ex.id IS NOT NULL THEN ver := ex.version + 1; sup := ex.id; END IF;
  INSERT INTO cm_entries(entry_key, version, supersedes, scope, bank, modality, task_type, signature, question_norm, answer, context, embedding, evidence, source, proposed_by)
    VALUES (k, ver, sup, p_scope, p_bank, coalesce(p_modality,'text'), p_task, p_sig, p_q, p_answer, coalesce(p_context,'{}'), p_embedding, p_evidence, p_source, a) RETURNING id INTO v;
  IF array_length(p_derived_from, 1) > 0 THEN INSERT INTO cm_derivations SELECT 'entry', v::text, x FROM unnest(p_derived_from) x ON CONFLICT DO NOTHING; END IF;
  IF sup IS NOT NULL THEN INSERT INTO cm_events(entry_id, kind, actor, reason, data) VALUES (v, 'conflict', 'system', 'contradicts active/pending entry', jsonb_build_object('other', sup)); st := 'quarantined'; END IF;
  -- 異常偵測：提案者近期被撤銷比例過高 → 自動隔離
  SELECT count(*) FILTER (WHERE s.state = 'revoked'), count(*) INTO n, tot FROM (SELECT id FROM cm_entries WHERE proposed_by = a ORDER BY id DESC LIMIT cm_cfg('anomaly_window')::int) e JOIN cm_status s ON s.entry_id = e.id;
  IF r = 'worker' AND tot >= 5 AND n::numeric / tot >= cm_cfg('anomaly_revoked_ratio') THEN INSERT INTO cm_events(entry_id, kind, actor, reason) VALUES (v, 'quarantine', 'system', 'proposer_anomaly'); st := 'quarantined'; END IF;
  IF p_scope = 'darkstar_private' THEN INSERT INTO cm_events(entry_id, kind, actor, reason) VALUES (v, 'verify', a, 'private'); st := 'active'; END IF;
  RETURN jsonb_build_object('id', v, 'version', ver, 'state', st);
END $$;

CREATE OR REPLACE FUNCTION public.cm_verify(p_id bigint, p_verification jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := cm_role(); a text := cm_actor(); e cm_entries; s record; nsrc int;
BEGIN
  IF r NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'VERIFY_DARKSTAR_OR_FOUNDER_ONLY'; END IF;
  SELECT * INTO e FROM cm_entries WHERE id = p_id; IF e.id IS NULL OR e.scope <> 'common' THEN RAISE EXCEPTION 'NOT_COMMON'; END IF;
  IF e.proposed_by = a THEN RAISE EXCEPTION 'SELF_VERIFY_FORBIDDEN'; END IF;
  SELECT * INTO s FROM cm_status WHERE entry_id = p_id; IF s.state <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING:%', s.state; END IF;
  SELECT count(DISTINCT x) INTO nsrc FROM (SELECT e.source x UNION SELECT data->>'source' FROM cm_events WHERE entry_id = p_id AND kind = 'corroborate'
     UNION SELECT jsonb_array_elements_text(coalesce(p_verification->'agreement','[]'::jsonb))) t;
  IF NOT (coalesce(p_verification->>'test_passed','') = 'true' OR nsrc >= cm_cfg('min_sources')) THEN RAISE EXCEPTION 'VERIFICATION_INSUFFICIENT'; END IF;
  INSERT INTO cm_events(entry_id, kind, actor, data) VALUES (p_id, 'verify', a, p_verification); RETURN 'active';
END $$;

-- 衝突裁決：依情境（天時地利人和）與來源數排序；勝者 release+verify，敗者 revoke（附理由）
CREATE OR REPLACE FUNCTION public.cm_resolve(p_winner bigint, p_loser bigint, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a text := cm_actor(); BEGIN
  IF cm_role() NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'RESOLVE_DARKSTAR_OR_FOUNDER_ONLY'; END IF;
  INSERT INTO cm_events(entry_id, kind, actor, reason) VALUES (p_winner, 'release', a, p_reason);
  IF NOT EXISTS (SELECT 1 FROM cm_events WHERE entry_id = p_winner AND kind = 'verify') THEN INSERT INTO cm_events(entry_id, kind, actor, reason) VALUES (p_winner, 'verify', a, 'conflict winner: ' || p_reason); END IF;
  PERFORM cm_revoke(p_loser, 'conflict loser: ' || p_reason); RETURN 'resolved'; END $$;

-- 撤銷＋連鎖：所有由它衍生的條目一起撤銷；訓練資料列經由 cm_training_rows_valid 自動失效
CREATE OR REPLACE FUNCTION public.cm_revoke(p_id bigint, p_reason text) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a text := cm_actor(); n int; BEGIN
  IF cm_role() NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'REVOKE_DARKSTAR_OR_FOUNDER_ONLY'; END IF;
  IF coalesce(p_reason,'') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  INSERT INTO cm_events(entry_id, kind, actor, reason) VALUES (p_id, 'revoke', a, p_reason);
  WITH RECURSIVE kids(id) AS (SELECT child_id::bigint FROM cm_derivations WHERE parent_entry = p_id AND child_kind = 'entry'
     UNION SELECT d.child_id::bigint FROM cm_derivations d JOIN kids k ON d.parent_entry = k.id WHERE d.child_kind = 'entry')
  INSERT INTO cm_events(entry_id, kind, actor, reason, data) SELECT id, 'cascade_revoke', a, p_reason, jsonb_build_object('root', p_id) FROM kids;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;

CREATE OR REPLACE FUNCTION public.cm_link_training_row(p_row text, p_parents bigint[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF cm_role() NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  INSERT INTO cm_derivations SELECT 'adapter_row', p_row, x FROM unnest(p_parents) x ON CONFLICT DO NOTHING; END $$;

-- 檢索：語意相似 × 天時（時間衰減）× 地利（district）× 人和（model）× 來源數；同 entry_key 只取得分最高（讀取時解衝突）
CREATE OR REPLACE FUNCTION public.cm_search(p_vec vector, p_task text, p_ctx jsonb, p_k int DEFAULT 5)
RETURNS TABLE (id bigint, entry_key text, answer jsonb, bank text, sim double precision, score double precision) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH cand AS (SELECT e.id, e.entry_key, e.answer, e.bank, e.context, e.created_at, 1 - (e.embedding <=> p_vec) AS sim
                FROM public.cm_entries e WHERE e.task_type = p_task ORDER BY e.embedding <=> p_vec LIMIT p_k * 8),
  live AS (SELECT c.*, s.sources FROM cand c JOIN public.cm_status s ON s.entry_id = c.id WHERE s.state = 'active'),
  scored AS (SELECT l.*, l.sim * power(0.5, extract(epoch FROM now() - l.created_at) / 86400 / public.cm_cfg('half_life_days'))
      * CASE WHEN l.context->>'district' IS NULL OR l.context->>'district' = p_ctx->>'district' THEN 1 ELSE public.cm_cfg('w_place_mismatch') END
      * CASE WHEN l.context->>'model' IS NULL OR l.context->>'model' = p_ctx->>'model' THEN 1 ELSE public.cm_cfg('w_people_mismatch') END
      * (1 + 0.1 * least(l.sources, 5)) AS score FROM live l)
  SELECT DISTINCT ON (entry_key) id, entry_key, answer, bank, sim, score FROM scored ORDER BY entry_key, score DESC $$;

REVOKE ALL ON FUNCTION public.cm_propose(text,text,text,text,text,text,jsonb,jsonb,vector,jsonb,text,bigint[]), public.cm_verify(bigint,jsonb), public.cm_resolve(bigint,bigint,text),
  public.cm_revoke(bigint,text), public.cm_link_training_row(text,bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cm_propose(text,text,text,text,text,text,jsonb,jsonb,vector,jsonb,text,bigint[]), public.cm_verify(bigint,jsonb), public.cm_resolve(bigint,bigint,text),
  public.cm_revoke(bigint,text), public.cm_link_training_row(text,bigint[]), public.cm_search(vector,text,jsonb,int) TO authenticated, service_role;
COMMIT;
-- 向量索引計畫（資料量 > 5 萬再建；建在 off-peak）：
-- CREATE INDEX CONCURRENTLY cm_entries_hnsw ON public.cm_entries USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- 查詢時 SET hnsw.ef_search = 40..100；依 task_type 篩選量大時改用 partial index（每個主要 task_type 一個）。
