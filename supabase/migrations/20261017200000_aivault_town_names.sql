-- ts3：會員自選暱稱（存在 auth user_metadata.name）。伺服器端再驗一次：1–12 字、去頭尾空白、不可冒充擁有者／暗星／官方、基本髒話過濾；不合格就用「會員 xxxx」
create or replace function public.aivault_safe_name(raw text) returns text language sql immutable as $$
  select case when n is null or n = '' or char_length(n) > 12
    or n ~* '(擁有者|owner|admin|管理員|官方|暗星|dark ?star|aivault|grok|👑|系統|客服)'
    or n ~* '(幹|操你|肏|靠北|靠杯|雞掰|機掰|雞巴|屌|婊|賤|妓|三小|白癡|白痴|智障|去死|fuck|shit|bitch|cunt|dick|nigg|asshole|傻逼|傻b|他媽|你媽|尼瑪)'
    then null else n end
  from (select btrim(regexp_replace(coalesce(raw,''), '[\u0000-\u001F<>]', '', 'g')) n) s
$$;
create or replace function public.aivault_presence_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare role text := auth.jwt()->'app_metadata'->>'role'; nm text;
begin
  new.user_id := auth.uid(); new.last_seen := now();
  new.workshop := coalesce(substring(regexp_replace(coalesce(new.workshop,''), '[^a-z0-9]', '', 'g') from 1 for 16), '');
  nm := public.aivault_safe_name(coalesce(auth.jwt()->'user_metadata'->>'name', auth.jwt()->'user_metadata'->>'full_name', ''));
  new.display_name := case when role = 'owner' then '👑 擁有者' else coalesce(nm, '會員 ' || left(new.user_id::text, 4)) end;
  new.seed := abs(hashtext(new.user_id::text)) % 100000;
  if tg_op = 'UPDATE' and (new.avatar is null or new.avatar = '') then new.avatar := old.avatar; end if;
  if coalesce(new.avatar,'') !~ '^((man|woman|elder|child):[0-7])?$' then new.avatar := ''; end if;
  return new;
end $$;
create or replace function public.aivault_world_chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n1 int; n2 int; role text := auth.jwt()->'app_metadata'->>'role'; nm text;
begin
  new.user_id := auth.uid(); new.created_at := now(); new.kind := 'human';
  new.body := left(regexp_replace(btrim(new.body), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g'), 300);
  if new.body = '' then raise exception 'EMPTY'; end if;
  select count(*) filter (where created_at > now() - interval '15 seconds'), count(*) filter (where created_at > now() - interval '1 hour')
    into n1, n2 from public.aivault_world_chat where user_id = new.user_id;
  if n1 > 0 then raise exception 'RATE_LIMIT_15S'; end if;
  if n2 >= 40 then raise exception 'RATE_LIMIT_HOUR'; end if;
  nm := public.aivault_safe_name(coalesce(auth.jwt()->'user_metadata'->>'name', auth.jwt()->'user_metadata'->>'full_name', ''));
  new.display_name := case when role = 'owner' then '👑 AIVAULT 擁有者' else coalesce(nm, 'AIVAULT 會員 ' || left(new.user_id::text, 4)) end;
  return new;
end $$;
