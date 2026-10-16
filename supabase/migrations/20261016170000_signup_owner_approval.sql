-- 註冊需擁有者核准（尚未套用；由擁有者確認後再執行）
-- 作法：新註冊的帳號自動被「暫停」（banned_until = infinity），無法登入或續期 token → 任何資料表都碰不到，不必逐表改 RLS。
-- 擁有者在 aivault-signup-approvals.html 核准 → 解除暫停並標記 approved。
-- 既有帳號完全不受影響（觸發器只作用在 INSERT），等同全部「預先核准」。
-- 回滾：drop trigger aivault_signup_pending on auth.users; drop function public.aivault_mark_signup_pending();
create or replace function public.aivault_mark_signup_pending()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  new.banned_until := 'infinity';
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('approved', false, 'pending_since', now());
  return new;
end $$;
revoke all on function public.aivault_mark_signup_pending() from public, anon, authenticated;
drop trigger if exists aivault_signup_pending on auth.users;
create trigger aivault_signup_pending before insert on auth.users
  for each row execute function public.aivault_mark_signup_pending();
