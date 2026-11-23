drop trigger if exists aivault_ai_novel_public_zz on public.dark_star_ebooks;
drop function if exists public.aivault_ai_novel_public_strip_private();
update public.dark_star_ebooks set visibility = 'members', metadata = metadata || '{"private":true}'::jsonb
where id in ('bf7927aa-4da2-4697-84d8-326dd900b79d','c5a8a914-4e0f-426f-a81e-bad021b5cde4','36cfae81-2149-41d0-afd9-8520df504e81','9d6c6eb2-4be2-4466-a26f-4a499ecceb18','42d9ad61-f4ab-4c38-aec8-4efb6467c0c2','b18378c0-91c9-433d-8640-1de7066ed340','fcd413e3-28a4-4533-bf1e-e191b4258e2e','108e496a-b1db-4f79-b73e-663c565ae856');
