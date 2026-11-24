-- UNAPPLIED ADDITIVE DRAFT. Tightens the historical hierarchy schema only.
-- Existing relationships must be inspected; never choose or delete a parent.
-- Apply after private_project_hierarchy.sql only in isolated acceptance first.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$
begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
 then raise exception 'Single-master precheck requires visibility of every private relationship';end if;
 lock table public.cc_records in access exclusive mode nowait;
 if exists(select 1 from public.cc_records where item_type='project_project_link' and deleted_at is null
  group by owner_id,payload->>'childProjectId' having count(*)>1)
 then raise exception 'Single-master migration blocked: preserve existing relationships and obtain explicit reconciliation';end if;
end $$;
create unique index cc_unique_active_private_project_parent
 on public.cc_records(owner_id,(payload->>'childProjectId'))
 where item_type='project_project_link' and deleted_at is null;
create function cc_private.validate_single_project_parent()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.item_type='project_project_link' and new.deleted_at is null then
  if pg_catalog.current_setting('transaction_isolation')<>'read committed'
  then raise exception 'Project relationship changes require read committed isolation';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cc-project-hierarchy:'||new.owner_id::text,0));
  if exists(select 1 from public.cc_records r where r.owner_id=new.owner_id
   and r.item_type='project_project_link' and r.deleted_at is null and r.id<>new.id
   and r.payload->>'childProjectId'=new.payload->>'childProjectId')
  then raise exception 'A smaller project can belong to only one master project. Unlink its current master first.';end if;
 end if;
 return new;
end $$;
create trigger cc_validate_single_project_parent before insert or update on public.cc_records
 for each row execute function cc_private.validate_single_project_parent();
revoke all on function cc_private.validate_single_project_parent() from public,anon,authenticated;
-- The app refuses the older several-parent schema. Check actual enabled guards,
-- not merely a migration filename or a client feature flag.
create function public.cc_project_hierarchy_single_master_ready()
returns boolean language sql stable security invoker set search_path='' as $$
 select cc_private.development_session_active() and exists(
  select 1 from pg_catalog.pg_index i
  where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_active_private_project_parent')
   and i.indrelid='public.cc_records'::regclass and i.indisunique and i.indisvalid and i.indnkeyatts=2
   and i.indkey[0]=(select attnum from pg_catalog.pg_attribute where attrelid=i.indrelid and attname='owner_id')
   and i.indkey[1]=0
   and pg_catalog.replace(pg_catalog.pg_get_expr(i.indexprs,i.indrelid),' ','')='(payload->>''childProjectId''::text)'
   and pg_catalog.replace(pg_catalog.pg_get_expr(i.indpred,i.indrelid),' ','')='((item_type=''project_project_link''::text)AND(deleted_atISNULL))'
 ) and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.cc_records'::regclass
  and tgname='cc_validate_single_project_parent' and tgenabled='O'
  and tgfoid='cc_private.validate_single_project_parent()'::regprocedure)
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.cc_records'::regclass
  and tgname='cc_validate_project_hierarchy_link' and tgenabled='O'
  and tgfoid='cc_private.validate_project_hierarchy_link()'::regprocedure)
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.cc_records'::regclass
  and tgname='cc_touch_project_relationship_targets' and tgenabled='O'
  and tgfoid='cc_private.touch_project_relationship_targets()'::regprocedure)
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.cc_records'::regclass
  and tgname='cc_protect_project_relationship_targets' and tgenabled='O'
  and tgfoid='cc_private.protect_project_relationship_targets()'::regprocedure);
$$;
revoke all on function public.cc_project_hierarchy_single_master_ready() from public,anon;
grant execute on function public.cc_project_hierarchy_single_master_ready() to authenticated;
commit;
