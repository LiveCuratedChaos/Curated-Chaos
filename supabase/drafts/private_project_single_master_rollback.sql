-- UNAPPLIED ROLLBACK. Refuses retained active OR retired relationships.
-- Never silently weaken protections on a nonempty graph.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$
begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
 then raise exception 'Single-master rollback requires visibility of every private relationship';end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed'
 then raise exception 'Single-master rollback requires read committed isolation';end if;
 lock table public.cc_records in access exclusive mode nowait;
 if exists(select 1 from public.cc_records where item_type='project_project_link')
 then raise exception 'Single-master rollback refused: retained relationships require their protections';end if;
end $$;
drop trigger cc_validate_single_project_parent on public.cc_records;
drop function public.cc_project_hierarchy_single_master_ready();
drop function cc_private.validate_single_project_parent();
drop index public.cc_unique_active_private_project_parent;
commit;
