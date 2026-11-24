-- Offline inverse. Preserve every retained membership, including tombstones.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK')
 or exists(select 1 from pg_catalog.pg_proc where pronamespace='cc_private'::regnamespace and proname in ('common_task_endpoint_matches','common_task_membership_matches')) then
 raise exception 'Retained common memberships require their guards and recovery contract';
 end if;
end$$;
-- No CASCADE: later dependent guards/indexes must prevent premature removal.
drop function cc_private.common_task_membership_key(jsonb,jsonb);
drop function cc_private.common_task_reference_key(jsonb,boolean);
commit;
