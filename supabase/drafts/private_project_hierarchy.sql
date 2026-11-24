-- UNAPPLIED DRAFT. Embedded/synthetic acceptance only; not in the hosted migration ledger.
-- Several larger projects may reference one subproject. No task copies or task writes.
begin;
create unique index cc_unique_private_project_relationship
 on public.cc_records(owner_id,(payload->>'parentProjectId'),(payload->>'childProjectId'))
 where item_type='project_project_link';

create function cc_private.validate_project_hierarchy_link()
returns trigger language plpgsql security invoker set search_path='' as $$
declare parent_row public.cc_records%rowtype;child_row public.cc_records%rowtype;actor uuid:=auth.uid();
begin
 if new.item_type<>'project_project_link' and (tg_op='INSERT' or old.item_type<>'project_project_link') then return new;end if;
 if tg_op='UPDATE' and (old.item_type<>new.item_type or old.payload<>new.payload or old.origin<>new.origin or old.section<>new.section or old.owner_id<>new.owner_id or old.visibility<>new.visibility or old.household_id is distinct from new.household_id) then raise exception 'Project relationship identity is immutable';end if;
 if actor is null or new.owner_id<>actor or not cc_private.development_session_active()
 or new.visibility<>'private' or new.household_id is not null or new.section<>'Personal Life' or new.origin is distinct from 'PRIVATE_COOKIE_PROJECT_PROJECT_LINK'
 or jsonb_typeof(new.payload)<>'object' or (select count(*) from jsonb_object_keys(new.payload))<>4
 or not(new.payload ?& array['fictional','schemaVersion','parentProjectId','childProjectId'])
 or new.payload->'fictional' is distinct from 'true'::jsonb or new.payload->'schemaVersion' is distinct from '1'::jsonb
 or jsonb_typeof(new.payload->'parentProjectId') is distinct from 'string' or jsonb_typeof(new.payload->'childProjectId') is distinct from 'string'
 or new.payload->>'parentProjectId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or new.payload->>'childProjectId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or new.payload->>'parentProjectId'=new.payload->>'childProjectId'
 then raise exception 'Exact private project relationship required';end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'Project relationship changes require read committed isolation';end if;
 -- Serialize ALL edges for this owner, including direct writes. Endpoint locks alone
 -- do not protect against cycles formed by concurrent changes on disjoint edges.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cc-project-hierarchy:'||actor::text,0));
 select * into parent_row from public.cc_records where id=(new.payload->>'parentProjectId')::uuid and owner_id=actor and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and (new.deleted_at is not null or deleted_at is null) for update;
 if not found or parent_row.payload->'fictional' is distinct from 'true'::jsonb or parent_row.payload->'schemaVersion' is distinct from '1'::jsonb or parent_row.section not in ('Home','Personal Life','Work','School') or jsonb_typeof(parent_row.payload->'title') is distinct from 'string' or char_length(btrim(parent_row.payload->>'title')) not between 1 and 140 or jsonb_typeof(parent_row.payload->'status') is distinct from 'string' or parent_row.payload->>'status' not in ('Planned','Active','On hold','Completed') then raise exception 'Supported larger private project required';end if;
 select * into child_row from public.cc_records where id=(new.payload->>'childProjectId')::uuid and owner_id=actor and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and (new.deleted_at is not null or deleted_at is null) for update;
 if not found or child_row.payload->'fictional' is distinct from 'true'::jsonb or child_row.payload->'schemaVersion' is distinct from '1'::jsonb or child_row.section not in ('Home','Personal Life','Work','School') or jsonb_typeof(child_row.payload->'title') is distinct from 'string' or char_length(btrim(child_row.payload->>'title')) not between 1 and 140 or jsonb_typeof(child_row.payload->'status') is distinct from 'string' or child_row.payload->>'status' not in ('Planned','Active','On hold','Completed') then raise exception 'Supported private subproject required';end if;
 if new.deleted_at is null then
  if (select count(*) from public.cc_records where owner_id=actor and item_type='project_project_link' and id<>new.id)>=2000 then raise exception 'Complete project relationship bound exceeded';end if;
  if exists(with recursive descendants(id) as (
   select (new.payload->>'childProjectId')::uuid
   union
   select (r.payload->>'childProjectId')::uuid from public.cc_records r join descendants d on r.payload->>'parentProjectId'=d.id::text
    where r.owner_id=actor and r.item_type='project_project_link' and r.deleted_at is null and r.id<>new.id
  ) select 1 from descendants where id=(new.payload->>'parentProjectId')::uuid) then raise exception 'Project relationship would create a cycle';end if;
 end if;
 return new;
end $$;
create trigger cc_validate_project_hierarchy_link before insert or update on public.cc_records for each row execute function cc_private.validate_project_hierarchy_link();

create function cc_private.touch_project_relationship_targets()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.item_type='project_project_link' and pg_trigger_depth()=1 and ((tg_op='INSERT' and new.deleted_at is null) or (tg_op='UPDATE' and new.deleted_at is distinct from old.deleted_at)) then
  update public.cc_records set payload=payload where owner_id=new.owner_id and id in ((new.payload->>'parentProjectId')::uuid,(new.payload->>'childProjectId')::uuid);
 end if;return new;
end $$;
create trigger cc_touch_project_relationship_targets after insert or update on public.cc_records for each row execute function cc_private.touch_project_relationship_targets();

create function cc_private.protect_project_relationship_targets()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.item_type='project' and (new.item_type<>old.item_type or new.deleted_at is distinct from old.deleted_at or new.owner_id<>old.owner_id or new.visibility<>old.visibility or new.household_id is distinct from old.household_id or new.origin<>old.origin or new.payload->'fictional' is distinct from 'true'::jsonb or new.payload->'schemaVersion' is distinct from '1'::jsonb or new.section not in ('Home','Personal Life','Work','School') or jsonb_typeof(new.payload->'title') is distinct from 'string' or char_length(btrim(new.payload->>'title')) not between 1 and 140 or jsonb_typeof(new.payload->'status') is distinct from 'string' or new.payload->>'status' not in ('Planned','Active','On hold','Completed')) then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cc-project-hierarchy:'||old.owner_id::text,0));
  if exists(select 1 from public.cc_records where owner_id=old.owner_id and item_type='project_project_link' and deleted_at is null and (payload->>'parentProjectId'=old.id::text or payload->>'childProjectId'=old.id::text)) then raise exception 'Unlink larger projects and subprojects before changing project scope or removing it';end if;
 end if;return new;
end $$;
create trigger cc_protect_project_relationship_targets before update on public.cc_records for each row execute function cc_private.protect_project_relationship_targets();

create function public.cc_set_project_hierarchy_link(p_parent_project_id uuid,p_parent_version integer,p_child_project_id uuid,p_child_version integer,p_link_version integer,p_linked boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();p public.cc_records%rowtype;c public.cc_records%rowtype;l public.cc_records%rowtype;
begin
 if actor is null or not cc_private.development_session_active() or p_parent_project_id is null or p_child_project_id is null or p_parent_project_id=p_child_project_id or p_parent_version is null or p_parent_version<1 or p_child_version is null or p_child_version<1 or p_link_version is null or p_link_version<0 or p_linked is null then raise exception 'Exact reviewed project relationship required';end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'Project relationship changes require read committed isolation';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cc-project-hierarchy:'||actor::text,0));
 select * into p from public.cc_records where id=p_parent_project_id and owner_id=actor and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and deleted_at is null for update;
 if not found or p.version<>p_parent_version or p.payload->'fictional' is distinct from 'true'::jsonb or p.payload->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Larger project changed; review again';end if;
 select * into c from public.cc_records where id=p_child_project_id and owner_id=actor and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and deleted_at is null for update;
 if not found or c.version<>p_child_version or c.payload->'fictional' is distinct from 'true'::jsonb or c.payload->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Subproject changed; review again';end if;
 select * into l from public.cc_records where owner_id=actor and item_type='project_project_link' and payload->>'parentProjectId'=p_parent_project_id::text and payload->>'childProjectId'=p_child_project_id::text for update;
 if coalesce(l.version,0)<>p_link_version then raise exception 'Project relationship changed; review again';end if;
 if p_linked then
  if l.id is null then insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload) values(actor,null,'private','Personal Life','project_project_link','PRIVATE_COOKIE_PROJECT_PROJECT_LINK',jsonb_build_object('fictional',true,'schemaVersion',1,'parentProjectId',p_parent_project_id::text,'childProjectId',p_child_project_id::text)) returning * into l;
  elsif l.deleted_at is not null then update public.cc_records set deleted_at=null where id=l.id returning * into l;
  else raise exception 'Subproject already belongs to larger project';end if;
 else
  if l.id is null or l.deleted_at is not null then raise exception 'Project relationship is not active';end if;
  update public.cc_records set deleted_at=statement_timestamp() where id=l.id returning * into l;
 end if;
 select * into p from public.cc_records where id=p_parent_project_id;
 select * into c from public.cc_records where id=p_child_project_id;
 return jsonb_build_object('parentId',p.id,'parentVersion',p.version,'childId',c.id,'childVersion',c.version,'linkRecord',to_jsonb(l));
end $$;

-- A stable function reads every class under one command snapshot. Sparse payloads
-- omit task descriptions/checklists and project descriptions, even for rollups.
create function public.cc_project_hierarchy_snapshot()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid();projects jsonb;relationships jsonb;tasks jsonb;memberships jsonb;
begin
 if actor is null or not cc_private.development_session_active() then raise exception 'Active private project sign-in required';end if;
 select coalesce(jsonb_agg(to_jsonb(r)-'payload'||jsonb_build_object('payload',jsonb_build_object('fictional',r.payload->'fictional','schemaVersion',r.payload->'schemaVersion','title',r.payload->'title','status',r.payload->'status')||case when r.payload ? 'separateRecurring' then jsonb_build_object('separateRecurring',r.payload->'separateRecurring') else '{}'::jsonb end) order by r.id),'[]'::jsonb) into projects from (select * from public.cc_records where owner_id=actor and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and deleted_at is null order by id limit 2001) r;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into relationships from (select * from public.cc_records where owner_id=actor and visibility='private' and household_id is null and item_type='project_project_link' and origin='PRIVATE_COOKIE_PROJECT_PROJECT_LINK' order by id limit 2001) r;
 select coalesce(jsonb_agg(to_jsonb(r)-'payload'||jsonb_build_object('payload',jsonb_build_object('fictional',r.payload->'fictional','title',r.payload->'title','done',r.payload->'done')||case when r.payload ? 'recurrence' then jsonb_build_object('recurrence',r.payload->'recurrence') else '{}'::jsonb end||case when r.payload ? 'recurrenceStopped' then jsonb_build_object('recurrenceStopped',r.payload->'recurrenceStopped') else '{}'::jsonb end) order by r.id),'[]'::jsonb) into tasks from (select * from public.cc_records where owner_id=actor and visibility='private' and household_id is null and item_type='task' and section in ('Home','Personal Life','Work','School') and deleted_at is null order by id limit 2001) r;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into memberships from (select * from public.cc_records where owner_id=actor and visibility='private' and household_id is null and item_type='project_task_link' and origin='PRIVATE_COOKIE_PROJECT_TASK_LINK' and deleted_at is null order by id limit 2001) r;
 if jsonb_array_length(projects)>2000 or jsonb_array_length(relationships)>2000 or jsonb_array_length(tasks)>2000 or jsonb_array_length(memberships)>2000 then raise exception 'Complete project hierarchy exceeds its verification bound';end if;
 return jsonb_build_object('projects',projects,'relationships',relationships,'tasks',tasks,'memberships',memberships);
end $$;
revoke all on function cc_private.validate_project_hierarchy_link(),cc_private.touch_project_relationship_targets(),cc_private.protect_project_relationship_targets() from public,anon,authenticated;
revoke all on function public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean),public.cc_project_hierarchy_snapshot() from public,anon;
grant execute on function public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean),public.cc_project_hierarchy_snapshot() to authenticated;
commit;
