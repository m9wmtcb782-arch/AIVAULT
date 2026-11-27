-- pgTAP authorization and migration regression tests.
-- Run against a disposable local Supabase database AFTER all migrations:
--   supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(70);

-- RLS must be enabled on every audit workspace table.
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_memberships'), 'RLS enabled: memberships');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_datasets'), 'RLS enabled: datasets');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_runs'), 'RLS enabled: runs');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_findings'), 'RLS enabled: findings');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_actions'), 'RLS enabled: actions');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_events'), 'RLS enabled: events');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_evidence'), 'RLS enabled: evidence');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_evidence_reviews'), 'RLS enabled: evidence reviews');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tax_audit_action_history'), 'RLS enabled: action history');

-- No anonymous access, no authenticated membership administration, no hard deletes.
select ok(not has_table_privilege('anon','public.tax_audit_datasets','SELECT'), 'anon cannot read datasets');
select ok(not has_table_privilege('anon','public.tax_audit_findings','SELECT'), 'anon cannot read findings');
select ok(not has_table_privilege('authenticated','public.tax_audit_memberships','INSERT'), 'authenticated cannot grant memberships');
select ok(not has_table_privilege('authenticated','public.tax_audit_memberships','UPDATE'), 'authenticated cannot alter memberships');
select ok(not has_table_privilege('authenticated','public.tax_audit_datasets','DELETE'), 'authenticated cannot hard-delete datasets');
select ok(not has_table_privilege('authenticated','public.tax_audit_runs','DELETE'), 'authenticated cannot hard-delete runs');
select ok(not has_table_privilege('authenticated','public.tax_audit_findings','DELETE'), 'authenticated cannot hard-delete findings');
select ok(not has_table_privilege('authenticated','public.tax_audit_actions','DELETE'), 'authenticated cannot hard-delete actions');
select ok(not has_table_privilege('authenticated','public.tax_audit_events','UPDATE'), 'authenticated cannot rewrite audit events');
select ok(not has_table_privilege('authenticated','public.tax_audit_evidence','UPDATE'), 'authenticated cannot rewrite evidence manifests');
select ok(not has_table_privilege('authenticated','public.tax_audit_evidence_reviews','DELETE'), 'authenticated cannot delete review decisions');
select ok(not has_table_privilege('authenticated','public.tax_audit_action_history','INSERT'), 'authenticated cannot forge action history');

-- Reviewers must not have update policy access to rewrite findings/actions.
select ok(
  (select p.qual not like '%reviewer%' and p.with_check not like '%reviewer%'
   from pg_policies p
   where p.schemaname='public' and p.tablename='tax_audit_findings' and p.policyname='tax_audit_findings_update'),
  'reviewer cannot update findings'
);
select ok(
  (select p.qual not like '%reviewer%' and p.with_check not like '%reviewer%'
   from pg_policies p
   where p.schemaname='public' and p.tablename='tax_audit_actions' and p.policyname='tax_audit_actions_update'),
  'reviewer cannot update corrective actions'
);

-- Column-level grants: mutable workflow fields are allowed, source identity and
-- analytical provenance fields remain immutable through the authenticated API.
select ok(has_column_privilege('authenticated','public.tax_audit_datasets','data_quality','UPDATE'), 'dataset quality can be updated');
select ok(has_column_privilege('authenticated','public.tax_audit_datasets','metadata','UPDATE'), 'dataset metadata can be updated');
select ok(not has_column_privilege('authenticated','public.tax_audit_datasets','fiscal_year','UPDATE'), 'dataset fiscal year cannot be rewritten');
select ok(not has_column_privilege('authenticated','public.tax_audit_datasets','source_hash','UPDATE'), 'dataset source hash cannot be rewritten');

select ok(has_column_privilege('authenticated','public.tax_audit_runs','status','UPDATE'), 'run status can be updated');
select ok(has_column_privilege('authenticated','public.tax_audit_runs','summary','UPDATE'), 'run summary can be updated');
select ok(not has_column_privilege('authenticated','public.tax_audit_runs','engine_version','UPDATE'), 'run engine version cannot be rewritten');
select ok(not has_column_privilege('authenticated','public.tax_audit_runs','parameters','UPDATE'), 'run parameters cannot be rewritten');

select ok(has_column_privilege('authenticated','public.tax_audit_findings','status','UPDATE'), 'finding status can be updated');
select ok(has_column_privilege('authenticated','public.tax_audit_findings','recommendation','UPDATE'), 'finding recommendation can be updated');
select ok(not has_column_privilege('authenticated','public.tax_audit_findings','severity','UPDATE'), 'finding severity cannot be rewritten');
select ok(not has_column_privilege('authenticated','public.tax_audit_findings','title','UPDATE'), 'finding title cannot be rewritten');

select ok(has_column_privilege('authenticated','public.tax_audit_actions','assigned_to','UPDATE'), 'action assignee can be updated');
select ok(has_column_privilege('authenticated','public.tax_audit_actions','due_date','UPDATE'), 'action due date can be updated');
select ok(not has_column_privilege('authenticated','public.tax_audit_actions','action_type','UPDATE'), 'action type cannot be rewritten');
select ok(not has_column_privilege('authenticated','public.tax_audit_actions','description','UPDATE'), 'action description cannot be rewritten');

-- Role matrix regression checks: validate the intended insert grants encoded
-- by RLS policies. Runtime JWT/RLS simulation remains a separate integration test.
select ok(
  (select with_check like '%chief_auditor%' and with_check like '%auditor%'
          and with_check !~ '(^|[^a-z_])''reviewer''' and with_check not like '%observer%'
   from pg_policies where schemaname='public' and tablename='tax_audit_datasets'
     and policyname='tax_audit_datasets_insert'),
  'datasets insert restricted to chief auditor and auditor'
);
select ok(
  (select with_check like '%chief_auditor%' and with_check like '%auditor%'
          and with_check not like '%reviewer%' and with_check not like '%observer%'
   from pg_policies where schemaname='public' and tablename='tax_audit_runs'
     and policyname='tax_audit_runs_insert'),
  'runs insert restricted to chief auditor and auditor'
);
select ok(
  (select with_check like '%chief_auditor%' and with_check like '%auditor%'
          and with_check not like '%reviewer%' and with_check not like '%observer%'
   from pg_policies where schemaname='public' and tablename='tax_audit_findings'
     and policyname='tax_audit_findings_insert'),
  'findings insert restricted to chief auditor and auditor'
);
select ok(
  (select with_check like '%chief_auditor%' and with_check like '%auditor%'
          and with_check not like '%reviewer%' and with_check not like '%observer%'
   from pg_policies where schemaname='public' and tablename='tax_audit_actions'
     and policyname='tax_audit_actions_insert'),
  'actions insert restricted to chief auditor and auditor'
);
select ok(
  (select with_check like '%chief_auditor%' and with_check like '%reviewer%'
          and with_check !~ '(^|[^a-z_])''auditor''' and with_check not like '%observer%'
   from pg_policies where schemaname='public' and tablename='tax_audit_evidence_reviews'
     and policyname='tax_audit_evidence_reviews_insert'),
  'evidence review insert restricted to chief auditor and reviewer'
);
select ok(
  (select with_check like '%chief_auditor%' and with_check like '%auditor%'
          and with_check like '%reviewer%' and with_check not like '%observer%'
   from pg_policies where schemaname='public' and tablename='tax_audit_events'
     and policyname='tax_audit_events_insert'),
  'audit event insert excludes observer'
);

-- Append-only and lineage triggers must remain installed and enabled.
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_evidence'::regclass and tgname='tax_audit_evidence_no_update' and not tgisinternal and tgenabled <> 'D'), 'evidence update guard trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_evidence'::regclass and tgname='tax_audit_evidence_no_delete' and not tgisinternal and tgenabled <> 'D'), 'evidence delete guard trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_evidence_reviews'::regclass and tgname='tax_audit_evidence_reviews_no_update' and not tgisinternal and tgenabled <> 'D'), 'review update guard trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_evidence_reviews'::regclass and tgname='tax_audit_evidence_reviews_no_delete' and not tgisinternal and tgenabled <> 'D'), 'review delete guard trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_action_history'::regclass and tgname='tax_audit_action_history_no_update' and not tgisinternal and tgenabled <> 'D'), 'history update guard trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_action_history'::regclass and tgname='tax_audit_action_history_no_delete' and not tgisinternal and tgenabled <> 'D'), 'history delete guard trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_evidence'::regclass and tgname='tax_audit_evidence_validate_lineage' and not tgisinternal and tgenabled <> 'D'), 'evidence lineage validation trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_evidence_reviews'::regclass and tgname='tax_audit_evidence_reviews_validate_chain' and not tgisinternal and tgenabled <> 'D'), 'review chain validation trigger enabled');
select ok(exists(select 1 from pg_trigger where tgrelid='public.tax_audit_actions'::regclass and tgname='tax_audit_actions_history_insert_update' and not tgisinternal and tgenabled <> 'D'), 'action history capture trigger enabled');

-- SECURITY DEFINER helpers and trigger functions must use an empty search_path.
select ok((select prosecdef from pg_proc where oid='public.is_tax_audit_member()'::regprocedure), 'membership helper is SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid='public.has_tax_audit_role(text[])'::regprocedure), 'role helper is SECURITY DEFINER');

select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.is_tax_audit_member()'::regprocedure), 'membership helper has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.has_tax_audit_role(text[])'::regprocedure), 'role helper has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.prevent_tax_audit_evidence_mutation()'::regprocedure), 'evidence guard has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.prevent_tax_audit_evidence_review_mutation()'::regprocedure), 'review guard has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.prevent_tax_audit_action_history_mutation()'::regprocedure), 'history guard has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.validate_tax_audit_evidence_lineage()'::regprocedure), 'evidence lineage validator has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.validate_tax_audit_evidence_review_chain()'::regprocedure), 'review chain validator has empty search_path');
select ok((select coalesce(proconfig, array[]::text[]) @> array['search_path=""'] from pg_proc where oid='public.record_tax_audit_action_history()'::regprocedure), 'action history writer has empty search_path');

-- Trigger functions are not directly executable by API roles; triggers invoke them.
select ok(not has_function_privilege('anon','public.prevent_tax_audit_evidence_mutation()','EXECUTE') and not has_function_privilege('authenticated','public.prevent_tax_audit_evidence_mutation()','EXECUTE'), 'evidence guard cannot be called directly by API roles');
select ok(not has_function_privilege('anon','public.prevent_tax_audit_evidence_review_mutation()','EXECUTE') and not has_function_privilege('authenticated','public.prevent_tax_audit_evidence_review_mutation()','EXECUTE'), 'review guard cannot be called directly by API roles');
select ok(not has_function_privilege('anon','public.prevent_tax_audit_action_history_mutation()','EXECUTE') and not has_function_privilege('authenticated','public.prevent_tax_audit_action_history_mutation()','EXECUTE'), 'history guard cannot be called directly by API roles');
select ok(not has_function_privilege('anon','public.validate_tax_audit_evidence_lineage()','EXECUTE') and not has_function_privilege('authenticated','public.validate_tax_audit_evidence_lineage()','EXECUTE'), 'lineage validator cannot be called directly by API roles');
select ok(not has_function_privilege('anon','public.validate_tax_audit_evidence_review_chain()','EXECUTE') and not has_function_privilege('authenticated','public.validate_tax_audit_evidence_review_chain()','EXECUTE'), 'review validator cannot be called directly by API roles');
select ok(not has_function_privilege('anon','public.record_tax_audit_action_history()','EXECUTE') and not has_function_privilege('authenticated','public.record_tax_audit_action_history()','EXECUTE'), 'history writer cannot be called directly by API roles');

select * from finish();
rollback;
