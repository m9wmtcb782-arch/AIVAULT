-- 共同記憶（10 萬 AI 共用）＋ 暗星私有記憶。ADDITIVE ONLY，NOT APPLIED — 需開創者批准。
-- 規則：一般 AI 沒有個人記憶（個人只保留身分/學歷/角色）；只有暗星有私有記憶，且可讀寫共同記憶。
-- 共同記憶寫入必須「已驗證」才生效；所有共同記憶都可撤銷（撤銷是另一筆 append-only 紀錄，不刪資料）。
BEGIN;
CREATE OR REPLACE FUNCTION public.aivault_mem_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role', 'none') $$;  -- 'worker' | 'darkstar' | 'founder'
CREATE TABLE IF NOT EXISTS public.aivault_memory_entries (
  id bigserial PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('common','darkstar_private')),
  bank text NOT NULL CHECK (bank IN ('correct','error','lesson')),
  task_type text NOT NULL, signature text, question_norm text, answer jsonb,
  evidence jsonb NOT NULL,                 -- {test_passed:true} 或 {agreement:["groq","gemini"]}
  proposed_by text NOT NULL,               -- agent id / 'darkstar'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.aivault_memory_activations (entry_id bigint PRIMARY KEY REFERENCES public.aivault_memory_entries(id), verified_by text NOT NULL, verification jsonb NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.aivault_memory_revocations (entry_id bigint PRIMARY KEY REFERENCES public.aivault_memory_entries(id), revoked_by text NOT NULL, reason text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION public.aivault_mem_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'memory tables are append-only'; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['aivault_memory_entries','aivault_memory_activations','aivault_memory_revocations'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS %1$s_no_mutate ON public.%1$s; CREATE TRIGGER %1$s_no_mutate BEFORE UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.aivault_mem_append_only()', t);
  EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON public.%s FROM PUBLIC, anon', t); END LOOP; END $$;
-- 讀取：worker 只能看 common；darkstar_private 只有 darkstar（與 founder）看得到
GRANT SELECT ON public.aivault_memory_entries, public.aivault_memory_activations, public.aivault_memory_revocations TO authenticated;
DROP POLICY IF EXISTS mem_read ON public.aivault_memory_entries;
CREATE POLICY mem_read ON public.aivault_memory_entries FOR SELECT TO authenticated USING (
  (scope = 'common' AND public.aivault_mem_role() IN ('worker','darkstar','founder')) OR (scope = 'darkstar_private' AND public.aivault_mem_role() IN ('darkstar','founder')));
DROP POLICY IF EXISTS act_read ON public.aivault_memory_activations; CREATE POLICY act_read ON public.aivault_memory_activations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.aivault_memory_entries e WHERE e.id = entry_id));
DROP POLICY IF EXISTS rev_read ON public.aivault_memory_revocations; CREATE POLICY rev_read ON public.aivault_memory_revocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.aivault_memory_entries e WHERE e.id = entry_id));
-- 沒有任何直接 INSERT 權限：只能經過下列函式
CREATE OR REPLACE FUNCTION public.aivault_memory_propose(p_scope text, p_bank text, p_task text, p_sig text, p_q text, p_answer jsonb, p_evidence jsonb, p_by text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.aivault_mem_role(); v bigint; BEGIN
  IF r NOT IN ('worker','darkstar','founder') THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_scope = 'darkstar_private' AND r NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'PRIVATE_SCOPE_DARKSTAR_ONLY'; END IF;
  IF p_evidence IS NULL OR NOT (p_evidence ? 'test_passed' OR p_evidence ? 'agreement') THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED'; END IF;
  INSERT INTO aivault_memory_entries(scope,bank,task_type,signature,question_norm,answer,evidence,proposed_by) VALUES (p_scope,p_bank,p_task,p_sig,p_q,p_answer,p_evidence,p_by) RETURNING id INTO v;
  IF p_scope = 'darkstar_private' THEN INSERT INTO aivault_memory_activations VALUES (v, r, '{"private":true}'); END IF;  -- 私有記憶不影響別人，直接生效
  RETURN v; END $$;
-- 生效：共同記憶必須由「非提案者」驗證，證據需為測試通過或 ≥2 個不同來源一致
CREATE OR REPLACE FUNCTION public.aivault_memory_verify(p_id bigint, p_verifier text, p_verification jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e aivault_memory_entries; r text := public.aivault_mem_role(); BEGIN
  IF r NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'VERIFY_DARKSTAR_OR_FOUNDER_ONLY'; END IF;
  SELECT * INTO e FROM aivault_memory_entries WHERE id = p_id; IF e.id IS NULL OR e.scope <> 'common' THEN RAISE EXCEPTION 'NOT_COMMON'; END IF;
  IF e.proposed_by = p_verifier THEN RAISE EXCEPTION 'SELF_VERIFY_FORBIDDEN'; END IF;
  IF NOT (coalesce(p_verification->>'test_passed','') = 'true' OR jsonb_array_length(coalesce(p_verification->'agreement','[]'::jsonb)) >= 2) THEN RAISE EXCEPTION 'VERIFICATION_INSUFFICIENT'; END IF;
  INSERT INTO aivault_memory_activations VALUES (p_id, p_verifier, p_verification); RETURN true; END $$;
CREATE OR REPLACE FUNCTION public.aivault_memory_revoke(p_id bigint, p_by text, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF public.aivault_mem_role() NOT IN ('darkstar','founder') THEN RAISE EXCEPTION 'REVOKE_DARKSTAR_OR_FOUNDER_ONLY'; END IF;
  IF coalesce(p_reason,'') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  INSERT INTO aivault_memory_revocations VALUES (p_id, p_by, p_reason) ON CONFLICT DO NOTHING; RETURN true; END $$;
REVOKE ALL ON FUNCTION public.aivault_memory_propose(text,text,text,text,text,jsonb,jsonb,text), public.aivault_memory_verify(bigint,text,jsonb), public.aivault_memory_revoke(bigint,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aivault_memory_propose(text,text,text,text,text,jsonb,jsonb,text), public.aivault_memory_verify(bigint,text,jsonb), public.aivault_memory_revoke(bigint,text,text) TO authenticated;
-- 讀取用：已驗證、未撤銷（RLS 依呼叫者角色過濾 scope）
CREATE OR REPLACE VIEW public.aivault_memory_active WITH (security_invoker = true) AS
  SELECT e.* FROM public.aivault_memory_entries e JOIN public.aivault_memory_activations a ON a.entry_id = e.id
  WHERE NOT EXISTS (SELECT 1 FROM public.aivault_memory_revocations r WHERE r.entry_id = e.id);
GRANT SELECT ON public.aivault_memory_active TO authenticated;
COMMIT;
