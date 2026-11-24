-- OFFLINE INVERSE. Refuses retained memberships; no data deletion or CASCADE.
begin;
-- Offline inverse only. Retain all source records and active/retired membership history.

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

-- Remove only the non-persistent recovery input after dependent writers are disabled.

set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if pg_catalog.to_regprocedure('public.cc_private_common_task_links_ready()') is not null or pg_catalog.to_regprocedure('public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean)') is not null
 or exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK') then raise exception 'Disable dependent writers and preserve retained graph recovery';end if;
end$$;
drop view cc_private.restore_new_task_graph;
drop function cc_private.restore_new_task_graph();

-- OFFLINE INVERSE: preserve writer signatures, privileges and behavior; restore original bodies.

set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin if exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK') or pg_catalog.to_regprocedure('public.cc_private_common_task_links_ready()') is not null then raise exception 'Retained canonical writers require their consistent lock order';end if;end$$;
do $cc_lock_check$ begin
 if true then
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.cc_set_task_project_link(uuid,integer,uuid,integer,integer,boolean)') and pg_catalog.md5(p.prosrc)='b250e12d738d29559438e29ea7eac2a4' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
create or replace function public.cc_set_task_project_link(p_task_id uuid,p_task_version integer,p_project_id uuid,p_project_version integer,p_link_version integer,p_linked boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();t public.cc_records%rowtype;p public.cc_records%rowtype;l public.cc_records%rowtype;
begin
 if actor is null or not cc_private.development_session_active() or p_task_id is null or p_project_id is null or p_task_version is null or p_task_version<1 or p_project_version is null or p_project_version<1 or p_link_version is null or p_link_version<0 or p_linked is null then raise exception 'Exact reviewed project membership required';end if;
 select * into t from public.cc_records where id=p_task_id and owner_id=actor and visibility='private' and household_id is null and item_type='task' and deleted_at is null for update;
 if not found or t.version<>p_task_version or t.payload->'fictional' is distinct from 'true'::jsonb then raise exception 'Task changed; review again';end if;
 select * into p from public.cc_records where id=p_project_id and owner_id=actor and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and deleted_at is null for share;
 if not found or p.version<>p_project_version then raise exception 'Project changed; review again';end if;
 select * into l from public.cc_records where owner_id=actor and item_type='project_task_link' and payload->>'taskId'=p_task_id::text and payload->>'projectId'=p_project_id::text for update;
 if coalesce(l.version,0)<>p_link_version then raise exception 'Project membership changed; review again';end if;
 if p_linked then
 if l.id is null then insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload) values(actor,null,'private','Personal Life','project_task_link','PRIVATE_COOKIE_PROJECT_TASK_LINK',jsonb_build_object('fictional',true,'schemaVersion',1,'taskId',p_task_id::text,'projectId',p_project_id::text)) returning * into l;
 elsif l.deleted_at is not null then update public.cc_records set deleted_at=null where id=l.id returning * into l;
 else raise exception 'Task already belongs to project';end if;
 else
 if l.id is null or l.deleted_at is not null then raise exception 'Task is not linked to this project';end if;
 update public.cc_records set deleted_at=statement_timestamp() where id=l.id returning * into l;
 end if;
 select * into t from public.cc_records where id=p_task_id;
 return jsonb_build_object('taskId',t.id,'taskVersion',t.version,'linkRecord',to_jsonb(l));
end $$;

do $cc_lock_check$ begin
 if true then
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.cc_complete_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid)') and pg_catalog.md5(p.prosrc)='cc3830f8d2238be528b4ac551f6b37d1' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
create or replace function public.cc_complete_recurring_chore(p_record_id uuid,p_version integer,p_schedule jsonb,p_next_day date,p_review_day date,p_operation_id uuid,p_successor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();source_row public.cc_records%rowtype;successor public.cc_records%rowtype;plan jsonb;series_id text;marker jsonb;recurrence jsonb;next_payload jsonb;steps jsonb;membership public.cc_records%rowtype;link_count integer:=0;
begin
 if actor is null or not cc_private.development_session_active() then raise exception 'Active sign-in required';end if;
 if p_record_id is null or p_version is null or p_version<1 or p_operation_id is null or p_successor_id is null or p_successor_id=p_record_id
 or p_review_day is null or p_next_day is null then raise exception 'Exact recurring review required';end if;
 select * into source_row from public.cc_records where id=p_record_id and owner_id=actor and visibility='private' and household_id is null and item_type='task' and deleted_at is null for update;
 if not found then raise exception 'Private chore unavailable';end if;
 marker:=jsonb_build_object('operationId',p_operation_id::text,'successorId',p_successor_id::text,'baseVersion',p_version,'schedule',p_schedule,'nextDay',p_next_day::text,'reviewDay',p_review_day::text);
 -- An exact replay returns the original result; it never creates or repairs rows.
 if source_row.payload->'recurrence_completion'=marker and source_row.payload->'done'='true'::jsonb and source_row.version=p_version+1 then
  select * into successor from public.cc_records where id=p_successor_id and owner_id=actor and visibility='private' and household_id is null and item_type='task' and deleted_at is null;
  if not found or successor.payload->>'recurrence_predecessor' is distinct from p_record_id::text then raise exception 'Existing successor requires review';end if;
  return jsonb_build_object('completedRecord',to_jsonb(source_row),'nextRecord',to_jsonb(successor),'alreadySaved',true,'projectLinkCount',(select count(*) from public.cc_records where owner_id=actor and item_type='project_task_link' and deleted_at is null and payload->>'taskId'=successor.id::text));
 end if;
 if p_review_day<>(timezone('America/New_York',statement_timestamp()))::date then raise exception 'The date changed; review again';end if;
 if source_row.version<>p_version or source_row.payload->'done' is distinct from 'false'::jsonb or source_row.payload->'fictional' is distinct from 'true'::jsonb
 or source_row.section not in ('Home','Personal Life','Work','School') or jsonb_typeof(source_row.payload->'title') is distinct from 'string'
 or char_length(btrim(source_row.payload->>'title')) not between 1 and 140
 or jsonb_typeof(source_row.payload->'day') is distinct from 'string' then raise exception 'Chore changed or cannot repeat';end if;
 plan:=cc_private.recurring_chore_plan(p_schedule,(source_row.payload->>'day')::date,p_review_day);
 if plan->>'day'<>p_next_day::text then raise exception 'Next date differs from the reviewed schedule';end if;
 series_id:=coalesce(source_row.payload->'recurrence'->>'seriesId',p_record_id::text);
 recurrence:=p_schedule||jsonb_build_object('seriesId',series_id,'ordinal',(plan->>'currentOrdinal')::integer);
 if source_row.payload ? 'recurrence' and source_row.payload->'recurrence' is distinct from recurrence then raise exception 'Existing schedule changed; review the series';end if;
 if source_row.payload ? 'recurrence_completion' then raise exception 'A prior completion requires review';end if;
 if source_row.payload ? 'description' and (jsonb_typeof(source_row.payload->'description')<>'string' or char_length(source_row.payload->>'description')>10000) then raise exception 'Complete instructions required';end if;
 if source_row.payload ? 'priority' and (jsonb_typeof(source_row.payload->'priority')<>'string' or source_row.payload->>'priority' not in ('Low','Normal','High','Urgent')) then raise exception 'Valid priority required';end if;
 steps:=coalesce(source_row.payload->'subtasks','[]'::jsonb);
 if jsonb_typeof(steps)<>'array' or jsonb_array_length(steps)>20 then raise exception 'Complete checklist required';end if;
 if exists(select 1 from jsonb_array_elements(steps) s where jsonb_typeof(s)<>'object' or jsonb_typeof(s->'title') is distinct from 'string' or char_length(btrim(s->>'title')) not between 1 and 140 or s->>'title' ~ E'[\r\n]' or jsonb_typeof(s->'done') is distinct from 'boolean') then raise exception 'Complete checklist required';end if;
 next_payload:=jsonb_build_object('title',source_row.payload->>'title','day',p_next_day::text,'done',false,'status','Not Started','fictional',true,'priority',coalesce(source_row.payload->>'priority','Normal'),'recurrence',p_schedule||jsonb_build_object('seriesId',series_id,'ordinal',(plan->>'ordinal')::integer),'recurrence_predecessor',p_record_id::text,'subtasks',coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid()::text,'title',s.value->>'title','done',false) order by s.ordinality) from jsonb_array_elements(steps) with ordinality s(value,ordinality)),'[]'::jsonb));
 if source_row.payload ? 'description' then next_payload:=next_payload||jsonb_build_object('description',source_row.payload->'description');end if;
 -- Either both changes commit or neither does, including on unique/index failures.
 update public.cc_records set payload=payload||jsonb_build_object('done',true,'status','Completed','recurrence',recurrence,'recurrence_completion',marker) where id=p_record_id returning * into source_row;
 insert into public.cc_records(id,owner_id,household_id,visibility,section,item_type,origin,payload) values(p_successor_id,actor,null,'private',source_row.section,'task','PRIVATE_RECURRING_CHORE',next_payload) returning * into successor;
 -- The source task lock also serializes reviewed membership changes. Inherit one
 -- membership per project, never task copies; failures roll back the whole save.
 for membership in select * from public.cc_records where owner_id=actor and item_type='project_task_link' and deleted_at is null and payload->>'taskId'=p_record_id::text order by payload->>'projectId' loop
  insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload) values(actor,null,'private','Personal Life','project_task_link','PRIVATE_COOKIE_PROJECT_TASK_LINK',jsonb_build_object('fictional',true,'schemaVersion',1,'taskId',p_successor_id::text,'projectId',membership.payload->>'projectId'));
  link_count:=link_count+1;
 end loop;
 select * into successor from public.cc_records where id=p_successor_id;
 return jsonb_build_object('completedRecord',to_jsonb(source_row),'nextRecord',to_jsonb(successor),'alreadySaved',false,'projectLinkCount',link_count);
end $$;

do $cc_lock_check$ begin
 if pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') is not null then
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') and pg_catalog.md5(p.prosrc)='01d21a3de25ea375cb983b1eb152a5db' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
do $cc_lock_apply$ begin if pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') is not null then execute $cc_lock_definition$create or replace function public.cc_set_project_hierarchy_link(p_parent_project_id uuid,p_parent_version integer,p_child_project_id uuid,p_child_version integer,p_link_version integer,p_linked boolean)
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
end $$;$cc_lock_definition$;end if;end $cc_lock_apply$;

-- Offline inverse only. No data removal, CASCADE or enabled-writer teardown.

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

-- Offline inverse. Preserve every retained membership, including tombstones.

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
