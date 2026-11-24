-- Remove only the non-persistent recovery input after dependent writers are disabled.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if pg_catalog.to_regprocedure('public.cc_private_common_task_links_ready()') is not null or pg_catalog.to_regprocedure('public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean)') is not null
 or exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK') then raise exception 'Disable dependent writers and preserve retained graph recovery';end if;
end$$;
drop view cc_private.restore_new_task_graph;
drop function cc_private.restore_new_task_graph();
commit;
