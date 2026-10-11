-- AIVAULT approval security regression tests.
-- Execute with a privileged test connection only.
-- Every test row is rolled back. No production records are modified.
begin;
do $$
declare
  base_id text := 'aivault-regression-' || gen_random_uuid()::text;
  digest text := repeat('a',64);
  first_ok boolean;
  second_ok boolean;
begin
  insert into aivault_agent_security.approval_challenges
    (request_id,agent_id,owner_id,tool_name,kind,input_digest,expires_at)
  values (base_id,'regression-agent','regression-owner','regression-tool','external_write',digest,now()+interval '1 minute');
  select aivault_agent_security.consume_approval(base_id,'regression-agent','wrong-owner','regression-tool','external_write',digest,'approved') into first_ok;
  if first_ok then raise exception 'FAIL: wrong owner accepted'; end if;
  select aivault_agent_security.consume_approval(base_id,'regression-agent','regression-owner','regression-tool','external_write',repeat('b',64),'approved') into first_ok;
  if first_ok then raise exception 'FAIL: wrong digest accepted'; end if;
  select aivault_agent_security.consume_approval(base_id,'regression-agent','regression-owner','regression-tool','external_write',digest,'approved') into first_ok;
  if not first_ok then raise exception 'FAIL: valid approval rejected'; end if;
  select aivault_agent_security.consume_approval(base_id,'regression-agent','regression-owner','regression-tool','external_write',digest,'approved') into second_ok;
  if second_ok then raise exception 'FAIL: replay accepted'; end if;
  insert into aivault_agent_security.approval_challenges
    (request_id,agent_id,owner_id,tool_name,kind,input_digest,expires_at)
  values (base_id||'-expired','regression-agent','regression-owner','regression-tool','external_write',digest,now()-interval '1 second');
  select aivault_agent_security.consume_approval(base_id||'-expired','regression-agent','regression-owner','regression-tool','external_write',digest,'approved') into first_ok;
  if first_ok then raise exception 'FAIL: expired approval accepted'; end if;
  raise notice 'PASS: owner, digest, valid, replay and expiry assertions';
end $$;
rollback;
