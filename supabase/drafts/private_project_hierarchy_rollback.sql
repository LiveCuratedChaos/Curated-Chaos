-- UNAPPLIED, ONCE-ONLY ROLLBACK DRAFT. No hosted execution is authorized.
-- Refuse every retained relationship, including soft-deleted history. Never
-- delete records or leave existing relationships without their protections.
begin;
do $$
begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
 and current_user<>(select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class where oid='public.cc_records'::regclass)
 then raise exception 'Hierarchy rollback requires a role that can inspect every private record';end if;
 if exists(select 1 from public.cc_records where item_type='project_project_link') then
  raise exception 'Hierarchy rollback refused: retained project relationships require their protections';
 end if;
end $$;
drop trigger cc_validate_project_hierarchy_link on public.cc_records;
drop trigger cc_touch_project_relationship_targets on public.cc_records;
drop trigger cc_protect_project_relationship_targets on public.cc_records;
drop function cc_private.validate_project_hierarchy_link();
drop function cc_private.touch_project_relationship_targets();
drop function cc_private.protect_project_relationship_targets();
drop function public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean);
drop function public.cc_project_hierarchy_snapshot();
drop index public.cc_unique_private_project_relationship;
commit;
