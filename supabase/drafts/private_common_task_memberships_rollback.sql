-- Offline inverse only. Retain all source records and active/retired membership history.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK') then
 raise exception 'Retained canonical memberships require their storage/lifecycle guards';end if;
end$$;
drop function public.cc_private_common_task_links_ready();
drop function public.cc_complete_common_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid);
drop function public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean);
drop trigger cc_common_task_recurring_carry_guard on public.cc_records;
drop trigger cc_common_task_manual_limit on public.cc_records;
drop trigger cc_common_task_protect_sources on public.cc_records;
drop trigger cc_common_task_touch_source on public.cc_records;
drop trigger cc_common_task_link_guard on public.cc_records;
drop function cc_private.common_task_recurring_carry_guard();
drop function cc_private.common_task_manual_limit();
drop function cc_private.common_task_protect_sources();
drop function cc_private.common_task_touch_source();
drop function cc_private.common_task_link_guard();
drop index public.cc_unique_common_task_pair;
commit;
