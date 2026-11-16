-- Separate development only. Keep the existing automatic-RLS event trigger active.
-- Some installations do not contain this Supabase-provided helper; those are unchanged.
begin;
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  if (select prorettype from pg_proc where oid='public.rls_auto_enable()'::regprocedure)<>'event_trigger'::regtype then
   raise exception 'Unexpected RLS helper type; review before changing grants';
  end if;
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
commit;
