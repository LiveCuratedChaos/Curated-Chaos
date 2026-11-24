-- Offline inverse only. No data removal, CASCADE or enabled-writer teardown.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if pg_catalog.to_regprocedure('cc_private.restore_new_task_graph()') is not null or exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK')
 or exists(select 1 from pg_catalog.pg_proc where pronamespace='public'::regnamespace and proname in ('cc_set_common_task_link','cc_complete_common_recurring_chore'))
 or exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.cc_records'::regclass and tgname like 'cc_common_task_%') then
 raise exception 'Retained memberships or enabled guards require the endpoint contract';
 end if;
end$$;
drop function cc_private.common_task_membership_matches(public.cc_records,public.cc_records,uuid,jsonb,boolean);
drop function cc_private.common_task_intrinsic(public.cc_records,jsonb,jsonb);
drop function cc_private.common_task_endpoint_matches(public.cc_records,uuid,jsonb,boolean,boolean);
drop function cc_private.common_task_trim(text);
commit;
