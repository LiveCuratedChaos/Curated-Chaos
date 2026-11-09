-- PREPARED ONLY: separate development database; owner approval before execution.
-- Read-only current-session check. No record/policy changes or session revocations.
begin;
create schema if not exists cc_private;
revoke all on schema cc_private from public, anon;
grant usage on schema cc_private to authenticated;

create function cc_private.development_session_active() returns boolean
language sql stable security definer set search_path=''
as $$
 select case
 when auth.jwt()->>'sub' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and auth.jwt()->>'session_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then exists(select 1 from auth.sessions s
   where s.id=(auth.jwt()->>'session_id')::uuid
     and s.user_id=(auth.jwt()->>'sub')::uuid)
 else false end;
$$;
revoke all on function cc_private.development_session_active() from public, anon;
grant execute on function cc_private.development_session_active() to authenticated;

create function public.cc_development_session_active() returns boolean
language sql stable security invoker set search_path=''
as $$ select cc_private.development_session_active(); $$;
revoke all on function public.cc_development_session_active() from public, anon;
grant execute on function public.cc_development_session_active() to authenticated;
commit;
