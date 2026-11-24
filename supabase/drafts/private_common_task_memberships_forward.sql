-- OFFLINE REVIEW CANDIDATE. Not installed; app/restore/concurrency acceptance remains required.
-- One transaction: preserve existing source records, or roll back every new catalog object.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.cc_private_school_recovery_ready()') and pg_catalog.md5(prosrc)='851c3a9c9442f114911f24e2e7da0216' and not prosecdef) then
 raise exception 'Reviewed School recovery prerequisite is not installed';end if;
end$$;
-- OFFLINE PREPARATION: preserve writer signatures, privileges and behavior; acquire the School owner lock before row/hierarchy locks.

set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin if pg_catalog.to_regprocedure('cc_private.school_lock(uuid)') is null then raise exception 'Reviewed School owner serialization is required';end if;end$$;
do $cc_lock_check$ begin
 if true then
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.cc_set_task_project_link(uuid,integer,uuid,integer,integer,boolean)') and pg_catalog.md5(p.prosrc)='61c33aed09d8b0f01caace6c211e89c4' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
create or replace function public.cc_set_task_project_link(p_task_id uuid,p_task_version integer,p_project_id uuid,p_project_version integer,p_link_version integer,p_linked boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();t public.cc_records%rowtype;p public.cc_records%rowtype;l public.cc_records%rowtype;
begin
 if actor is null or not cc_private.development_session_active() or p_task_id is null or p_project_id is null or p_task_version is null or p_task_version<1 or p_project_version is null or p_project_version<1 or p_link_version is null or p_link_version<0 or p_linked is null then raise exception 'Exact reviewed project membership required';end if;
 perform cc_private.school_lock(actor);
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
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.cc_complete_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid)') and pg_catalog.md5(p.prosrc)='95266e58782ccbc6f37d13bde58f028e' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
create or replace function public.cc_complete_recurring_chore(p_record_id uuid,p_version integer,p_schedule jsonb,p_next_day date,p_review_day date,p_operation_id uuid,p_successor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();source_row public.cc_records%rowtype;successor public.cc_records%rowtype;plan jsonb;series_id text;marker jsonb;recurrence jsonb;next_payload jsonb;steps jsonb;membership public.cc_records%rowtype;link_count integer:=0;
begin
 if actor is null or not cc_private.development_session_active() then raise exception 'Active sign-in required';end if;
 if p_record_id is null or p_version is null or p_version<1 or p_operation_id is null or p_successor_id is null or p_successor_id=p_record_id
 or p_review_day is null or p_next_day is null then raise exception 'Exact recurring review required';end if;
 perform cc_private.school_lock(actor);
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
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') and pg_catalog.md5(p.prosrc)='9d3141452537b0d1a8c11706c1cffd75' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
do $cc_lock_apply$ begin if pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') is not null then execute $cc_lock_definition$create or replace function public.cc_set_project_hierarchy_link(p_parent_project_id uuid,p_parent_version integer,p_child_project_id uuid,p_child_version integer,p_link_version integer,p_linked boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();p public.cc_records%rowtype;c public.cc_records%rowtype;l public.cc_records%rowtype;
begin
 if actor is null or not cc_private.development_session_active() or p_parent_project_id is null or p_child_project_id is null or p_parent_project_id=p_child_project_id or p_parent_version is null or p_parent_version<1 or p_child_version is null or p_child_version<1 or p_link_version is null or p_link_version<0 or p_linked is null then raise exception 'Exact reviewed project relationship required';end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'Project relationship changes require read committed isolation';end if;
 perform cc_private.school_lock(actor);
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

-- OFFLINE PREPARATION ONLY. No membership table, writer, trigger, or runtime activation.
-- Canonical key functions are prerequisites for later reviewed storage guards/indexes.

create function cc_private.common_task_reference_key(p_reference jsonb,p_task boolean)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare k text;keys text[];field text;
begin
 if p_task is null or jsonb_typeof(p_reference) is distinct from 'object'
 or jsonb_typeof(p_reference->'kind') is distinct from 'string' then return null;end if;
 k:=p_reference->>'kind';
 if (p_task and k not in ('task','school-step'))
 or (not p_task and k not in ('project','school-degree','school-course','school-assessment')) then return null;end if;
 keys:=array['kind','recordId'];
 if k in ('school-assessment','school-step') then keys:=keys||'academicId'::text;end if;
 if k='school-step' then keys:=keys||'assessmentId'::text;end if;
 if (select count(*) from jsonb_object_keys(p_reference))<>cardinality(keys)
 or not(p_reference ?& keys) then return null;end if;
 foreach field in array keys loop
 if field='kind' then continue;end if;
 if jsonb_typeof(p_reference->field) is distinct from 'string'
 or p_reference->>field !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null;end if;
 end loop;
 return k||':'||lower(p_reference->>'recordId')
 ||case when k='school-step' then ':'||lower(p_reference->>'assessmentId') else '' end
 ||case when k in ('school-step','school-assessment') then ':'||lower(p_reference->>'academicId') else '' end;
end$$;
create function cc_private.common_task_membership_key(p_task jsonb,p_project jsonb)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare t text;p text;
begin
 t:=cc_private.common_task_reference_key(p_task,true);
 p:=cc_private.common_task_reference_key(p_project,false);
 if t is null or p is null or (p_task->>'kind'='task' and p_project->>'kind'='project') then return null;end if;
 return t||'|'||p;
end$$;
revoke all on function cc_private.common_task_reference_key(jsonb,boolean),cc_private.common_task_membership_key(jsonb,jsonb) from public,anon;
grant execute on function cc_private.common_task_reference_key(jsonb,boolean),cc_private.common_task_membership_key(jsonb,jsonb) to authenticated;

-- OFFLINE PREPARATION ONLY. Canonical endpoint predicates, no membership writer or activation.
-- Requires private_school_records, private_school_academic_recovery and common reference contracts.

create function cc_private.common_task_trim(v text) returns text language sql immutable security invoker set search_path='' as $$
 select btrim(v,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
create function cc_private.common_task_endpoint_matches(p_row public.cc_records,p_owner uuid,p_reference jsonb,p_task boolean,p_history boolean default false)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare k text;p jsonb;copy public.cc_records%rowtype;a jsonb;t jsonb;e jsonb;n integer:=0;parents jsonb:='[]'::jsonb;recurrence jsonb;
begin
 if p_owner is null or not cc_private.school_uuid(p_owner::text) or p_task is null or p_history is null
 or cc_private.common_task_reference_key(p_reference,p_task) is null
 or p_row.id is null or lower(p_reference->>'recordId')<>p_row.id::text
 or p_row.owner_id is distinct from p_owner or p_row.visibility is distinct from 'private'
 or p_row.household_id is not null or p_row.version is null or p_row.version<1
 or p_row.created_at is null or p_row.updated_at is null or not isfinite(p_row.created_at) or not isfinite(p_row.updated_at)
 or extract(year from p_row.created_at) not between 1 and 9999 or extract(year from p_row.updated_at) not between 1 and 9999
 or (p_row.deleted_at is not null and (not p_history or not isfinite(p_row.deleted_at) or extract(year from p_row.deleted_at) not between 1 and 9999)) then return false;end if;
 k:=p_reference->>'kind';p:=p_row.payload;
 if k='task' then
 if coalesce(p->'recurrenceStopped','null'::jsonb)<>'null'::jsonb and jsonb_typeof(p->'recurrenceStopped') is distinct from 'boolean' then return false;end if;
 recurrence:=p->'recurrence';
 if recurrence is not null and recurrence<>'null'::jsonb then
 if jsonb_typeof(recurrence) is distinct from 'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(recurrence))<>5 or not(recurrence?&array['anchorDay','frequency','interval','ordinal','seriesId'])
 or not cc_private.school_uuid(recurrence->>'seriesId') or not cc_private.school_number(recurrence->'ordinal',37000,true)
 or not cc_private.school_day(recurrence->'anchorDay') or recurrence->>'anchorDay'=''
 or (recurrence->>'frequency' in ('daily','weekly','monthly','yearly')) is not true
 or not cc_private.school_number(recurrence->'interval',365,true) or (recurrence->>'interval')::numeric<1 then return false;end if;
 end if;
 return coalesce(p_row.item_type='task' and p_row.section in ('Home','Personal Life','Work','School')
 and p->'fictional'='true'::jsonb and jsonb_typeof(p->'title')='string' and cc_private.school_text(p->'title',140,true)
 and length(cc_private.common_task_trim(p->>'title'))>0 and p->>'title'!~'[\x00-\x1f\x7f]' and jsonb_typeof(p->'done')='boolean',false);
 elsif k='project' then
 return coalesce(p_row.item_type='project' and p_row.origin='PRIVATE_COOKIE_PROJECT' and p_row.section in ('Home','Personal Life','Work','School')
 and jsonb_typeof(p)='object' and (select count(*) from jsonb_object_keys(p))=case when p?'separateRecurring' then 6 else 5 end
 and p?&array['fictional','schemaVersion','title','status','description'] and p->'fictional'='true'::jsonb and p->'schemaVersion'='1'::jsonb
 and jsonb_typeof(p->'title')='string' and cc_private.school_text(p->'title',140,true) and p->>'title'=cc_private.common_task_trim(p->>'title') and p->>'title'!~'[\x00-\x1f\x7f]'
 and p->>'status' in ('Planned','Active','On hold','Completed') and cc_private.school_text(p->'description',10000)
 and p->>'description'!~'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]'
 and (not(p?'separateRecurring') or jsonb_typeof(p->'separateRecurring')='boolean'),false);
 end if;
 copy:=p_row;copy.deleted_at:=null;
 if cc_private.school_record(copy) is not true or cc_private.school_recovery_payload(p) is not true then return false;end if;
 if length(cc_private.common_task_trim(p->>'title'))=0 then return false;end if;
 if k='school-degree' then return p->>'kind'='degree';end if;
 if p->>'kind' is distinct from 'course' then return false;end if;
 for a in select value from jsonb_array_elements(p->'assessments') loop
 if length(cc_private.common_task_trim(a->>'title'))=0 then return false;end if;
 for t in select value from jsonb_array_elements(a->'tasks') loop if length(cc_private.common_task_trim(t->>'title'))=0 then return false;end if;end loop;
 end loop;
 for t in select value from jsonb_array_elements(p->'studySessions') loop if length(cc_private.common_task_trim(t->>'title'))=0 then return false;end if;end loop;
 for e in select value from jsonb_array_elements(coalesce(p->'removedAcademicRecords','[]'::jsonb)) loop
 a:=e->'record';if length(cc_private.common_task_trim(a->>'title'))=0 then return false;end if;
 if e->>'kind'='assessment' then for t in select value from jsonb_array_elements(a->'tasks') loop if length(cc_private.common_task_trim(t->>'title'))=0 then return false;end if;end loop;end if;
 end loop;
 if k='school-course' then return true;end if;
 if p->'academicIdentityVersion' is distinct from '1'::jsonb then return false;end if;
 parents:=p->'assessments';
 if p_history then
 for e in select value from jsonb_array_elements(coalesce(p->'removedAcademicRecords','[]'::jsonb)) loop
 if e->>'kind'='assessment' then parents:=parents||jsonb_build_array(e->'record');end if;
 end loop;
 end if;
 if k='school-assessment' then
 select count(*) into n from jsonb_array_elements(parents) v where lower(v->>'academicId')=lower(p_reference->>'academicId');
 return n=1;
 end if;
 if k<>'school-step' then return false;end if;
 for a in select value from jsonb_array_elements(parents) where lower(value->>'academicId')=lower(p_reference->>'assessmentId') loop
 for t in select value from jsonb_array_elements(a->'tasks') loop
 if lower(t->>'academicId')=lower(p_reference->>'academicId') then n:=n+1;end if;
 end loop;
 if p_history then
 for e in select value from jsonb_array_elements(coalesce(p->'removedAcademicRecords','[]'::jsonb)) loop
 if e->>'kind'='step' and lower(e->>'parentAcademicId')=lower(a->>'academicId') and lower(e->'record'->>'academicId')=lower(p_reference->>'academicId') then n:=n+1;end if;
 end loop;
 end if;
 end loop;
 return n=1;
end$$;
create function cc_private.common_task_intrinsic(p_task_row public.cc_records,p_task jsonb,p_project jsonb)
returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(p_task->>'kind'='school-step' and (
 (p_project->>'kind'='school-degree' and lower(p_task_row.payload->>'degreeId')=lower(p_project->>'recordId'))
 or (lower(p_task->>'recordId')=lower(p_project->>'recordId') and (
 p_project->>'kind'='school-course' or (p_project->>'kind'='school-assessment' and lower(p_task->>'assessmentId')=lower(p_project->>'academicId'))))),false)
$$;
create function cc_private.common_task_membership_matches(p_task_row public.cc_records,p_project_row public.cc_records,p_owner uuid,p_payload jsonb,p_history boolean default false)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if p_history is null or jsonb_typeof(p_payload) is distinct from 'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(p_payload))<>4 or not(p_payload?&array['fictional','schemaVersion','task','project'])
 or p_payload->'fictional' is distinct from 'true'::jsonb or p_payload->'schemaVersion' is distinct from '1'::jsonb
 or cc_private.common_task_membership_key(p_payload->'task',p_payload->'project') is null then return false;end if;
 if cc_private.common_task_endpoint_matches(p_task_row,p_owner,p_payload->'task',true,p_history) is not true
 or cc_private.common_task_endpoint_matches(p_project_row,p_owner,p_payload->'project',false,p_history) is not true then return false;end if;
 return p_history or not cc_private.common_task_intrinsic(p_task_row,p_payload->'task',p_payload->'project');
end$$;
revoke all on function cc_private.common_task_membership_matches(public.cc_records,public.cc_records,uuid,jsonb,boolean),cc_private.common_task_trim(text),cc_private.common_task_endpoint_matches(public.cc_records,uuid,jsonb,boolean,boolean),cc_private.common_task_intrinsic(public.cc_records,jsonb,jsonb) from public,anon;
grant execute on function cc_private.common_task_membership_matches(public.cc_records,public.cc_records,uuid,jsonb,boolean),cc_private.common_task_trim(text),cc_private.common_task_endpoint_matches(public.cc_records,uuid,jsonb,boolean,boolean),cc_private.common_task_intrinsic(public.cc_records,jsonb,jsonb) to authenticated;

-- OFFLINE PREPARATION ONLY. Do not install/enable before recurrence, restore and readiness integration.
-- Existing manual membership representations are preserved; no data rewrites or task copies.

set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin
 if exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK') then
 raise exception 'Existing common membership reservations require individual review';end if;
end$$;
create unique index cc_unique_common_task_pair on public.cc_records(owner_id,cc_private.common_task_membership_key(payload->'task',payload->'project')) where item_type='common_task_link';
create function cc_private.common_task_link_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare t public.cc_records%rowtype;p public.cc_records%rowtype;key text;counted integer;
begin
 if tg_op='DELETE' then
 if old.item_type='common_task_link' or old.origin='PRIVATE_COOKIE_COMMON_TASK_LINK' then raise exception 'Retain canonical membership history';end if;return old;
 end if;
 if new.item_type<>'common_task_link' and new.origin<>'PRIVATE_COOKIE_COMMON_TASK_LINK' and (tg_op='INSERT' or (old.item_type<>'common_task_link' and old.origin<>'PRIVATE_COOKIE_COMMON_TASK_LINK')) then return new;end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.household_id is distinct from old.household_id or new.visibility is distinct from old.visibility or new.item_type is distinct from old.item_type or new.origin is distinct from old.origin or new.section is distinct from old.section or new.payload is distinct from old.payload) then raise exception 'Canonical membership identity is immutable';end if;
 if auth.uid() is null or new.owner_id is distinct from auth.uid() or not cc_private.development_session_active()
 or new.item_type is distinct from 'common_task_link' or new.origin is distinct from 'PRIVATE_COOKIE_COMMON_TASK_LINK'
 or new.visibility is distinct from 'private' or new.household_id is not null or new.section is distinct from 'Personal Life'
 or jsonb_typeof(new.payload) is distinct from 'object' then raise exception 'Owned private canonical membership required';end if;
 key:=cc_private.common_task_membership_key(new.payload->'task',new.payload->'project');if key is null then raise exception 'Exact canonical membership references required';end if;
 if public.cc_private_common_task_links_ready() is not true then raise exception 'Canonical membership storage could not be verified';end if;
 perform cc_private.school_lock(new.owner_id);
 perform 1 from public.cc_records where owner_id=new.owner_id and id in ((new.payload->'task'->>'recordId')::uuid,(new.payload->'project'->>'recordId')::uuid) order by id for update;
 select * into t from public.cc_records where id=(new.payload->'task'->>'recordId')::uuid and owner_id=new.owner_id;
 select * into p from public.cc_records where id=(new.payload->'project'->>'recordId')::uuid and owner_id=new.owner_id;
 if cc_private.common_task_membership_matches(t,p,new.owner_id,new.payload,new.deleted_at is not null) is not true then raise exception 'Current canonical membership endpoints required';end if;
 if new.deleted_at is null then
 select count(*) into counted from public.cc_records l where l.owner_id=new.owner_id and l.deleted_at is null and l.id<>new.id and (
 (l.item_type='common_task_link' and cc_private.common_task_reference_key(l.payload->'task',true)=cc_private.common_task_reference_key(new.payload->'task',true))
 or (new.payload->'task'->>'kind'='task' and l.item_type='project_task_link' and lower(l.payload->>'taskId')=lower(new.payload->'task'->>'recordId')));
 if counted>=50 then raise exception 'Task project limit reached';end if;
 end if;return new;
end$$;
create trigger cc_common_task_link_guard before insert or update or delete on public.cc_records for each row execute function cc_private.common_task_link_guard();
create function cc_private.common_task_touch_source() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if pg_trigger_depth()=1 and new.item_type='common_task_link' and ((tg_op='INSERT' and new.deleted_at is null) or (tg_op='UPDATE' and new.deleted_at is distinct from old.deleted_at)) then
 update public.cc_records set payload=payload where id=(new.payload->'task'->>'recordId')::uuid and owner_id=new.owner_id;
 end if;return new;
end$$;
create trigger cc_common_task_touch_source after insert or update on public.cc_records for each row execute function cc_private.common_task_touch_source();
create function cc_private.common_task_manual_limit() returns trigger language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if new.item_type='project_task_link' and new.deleted_at is null then
 if new.owner_id is distinct from auth.uid() then raise exception 'Owned task memberships required';end if;
 if public.cc_private_common_task_links_ready() is not true then raise exception 'Canonical membership storage could not be verified';end if;
 perform cc_private.school_lock(new.owner_id);
 select count(*) into n from public.cc_records l where l.owner_id=new.owner_id and l.deleted_at is null and l.id<>new.id and (
 (l.item_type='project_task_link' and lower(l.payload->>'taskId')=lower(new.payload->>'taskId'))
 or (l.item_type='common_task_link' and l.payload->'task'->>'kind'='task' and lower(l.payload->'task'->>'recordId')=lower(new.payload->>'taskId')));
 if n>=50 then raise exception 'Task project limit reached';end if;
 end if;return new;
end$$;
create trigger cc_common_task_manual_limit before insert or update on public.cc_records for each row execute function cc_private.common_task_manual_limit();
create function cc_private.common_task_protect_sources() returns trigger language plpgsql security invoker set search_path='' as $$
declare l public.cc_records%rowtype;t public.cc_records%rowtype;p public.cc_records%rowtype;task_role boolean;project_role boolean;checked boolean:=false;
begin
 for l in select * from public.cc_records where owner_id=old.owner_id and item_type='common_task_link' and (lower(payload->'task'->>'recordId')=old.id::text or lower(payload->'project'->>'recordId')=old.id::text) order by id loop
 if not checked then if public.cc_private_common_task_links_ready() is not true then raise exception 'Canonical membership storage could not be verified';end if; checked:=true;end if;
 if tg_op='DELETE' then raise exception 'Retained memberships require their canonical source';end if;
 task_role:=lower(l.payload->'task'->>'recordId')=old.id::text;project_role:=lower(l.payload->'project'->>'recordId')=old.id::text;
 if task_role then t:=new;else select * into t from public.cc_records where id=(l.payload->'task'->>'recordId')::uuid and owner_id=l.owner_id;end if;
 if project_role then p:=new;else select * into p from public.cc_records where id=(l.payload->'project'->>'recordId')::uuid and owner_id=l.owner_id;end if;
 if cc_private.common_task_membership_matches(t,p,l.owner_id,l.payload,true) is not true then raise exception 'Preserve canonical membership source history';end if;
 if l.deleted_at is null then
 if cc_private.common_task_endpoint_matches(p,l.owner_id,l.payload->'project',false,false) is not true then raise exception 'Unlink tasks before removing their project target';end if;
 if cc_private.common_task_endpoint_matches(t,l.owner_id,l.payload->'task',true,false) is not true then
 update public.cc_records set deleted_at=coalesce(new.deleted_at,statement_timestamp()) where id=l.id and owner_id=l.owner_id and deleted_at is null;
 elsif cc_private.common_task_intrinsic(t,l.payload->'task',l.payload->'project') then
 raise exception 'Unlink the independent membership before making it an intrinsic academic relationship';
 end if;
 end if;
 end loop;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
create trigger cc_common_task_protect_sources before update or delete on public.cc_records for each row execute function cc_private.common_task_protect_sources();
-- Prevent an older recurrence writer from silently dropping common memberships.
-- Later carry-forward integration must satisfy this final-state, transaction-level guard.
create function cc_private.common_task_recurring_carry_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.cc_records%rowtype;successor public.cc_records%rowtype;l public.cc_records%rowtype;marker jsonb;next_id uuid;
begin
 if new.item_type<>'task' or new.payload->'recurrence_completion' is not distinct from old.payload->'recurrence_completion' or new.payload->'done' is distinct from 'true'::jsonb then return new;end if;
 select * into source from public.cc_records where id=new.id and owner_id=new.owner_id;
 marker:=new.payload->'recurrence_completion';
 if source.payload->'recurrence_completion' is distinct from marker then return new;end if;
 if not exists(select 1 from public.cc_records where owner_id=new.owner_id and item_type='common_task_link' and deleted_at is null and payload->'task'->>'kind'='task' and lower(payload->'task'->>'recordId')=new.id::text) then return new;end if;
 if public.cc_private_common_task_links_ready() is not true then raise exception 'Canonical membership storage could not be verified';end if;
 if jsonb_typeof(marker) is distinct from 'object' or not cc_private.school_uuid(marker->>'successorId') then raise exception 'Exact recurring successor required';end if;
 next_id:=(marker->>'successorId')::uuid;
 select * into successor from public.cc_records where id=next_id and owner_id=new.owner_id;
 if cc_private.common_task_endpoint_matches(successor,new.owner_id,jsonb_build_object('kind','task','recordId',next_id::text),true,false) is not true or successor.payload->>'recurrence_predecessor' is distinct from new.id::text then raise exception 'Atomic recurring successor required';end if;
 for l in select * from public.cc_records where owner_id=new.owner_id and item_type='common_task_link' and deleted_at is null and payload->'task'->>'kind'='task' and lower(payload->'task'->>'recordId')=new.id::text loop
 if not exists(select 1 from public.cc_records carried where carried.owner_id=new.owner_id and carried.item_type='common_task_link' and carried.deleted_at is null
 and cc_private.common_task_reference_key(carried.payload->'task',true)='task:'||next_id::text
 and cc_private.common_task_reference_key(carried.payload->'project',false)=cc_private.common_task_reference_key(l.payload->'project',false)) then raise exception 'Atomic canonical recurring membership carry-forward required';end if;
 end loop;return new;
end$$;
create constraint trigger cc_common_task_recurring_carry_guard after update on public.cc_records deferrable initially deferred for each row execute function cc_private.common_task_recurring_carry_guard();
create function public.cc_set_common_task_link(p_task jsonb,p_task_version integer,p_project jsonb,p_project_version integer,p_link_version integer,p_linked boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();t public.cc_records%rowtype;p public.cc_records%rowtype;l public.cc_records%rowtype;key text;proposed jsonb;
begin
 key:=cc_private.common_task_membership_key(p_task,p_project);
 if actor is null or not cc_private.development_session_active() or key is null or p_task_version is null or p_task_version<1 or p_project_version is null or p_project_version<1 or p_link_version is null or p_link_version<0 or p_linked is null then raise exception 'Exact current canonical membership review required';end if;
 if public.cc_private_common_task_links_ready() is not true then raise exception 'Canonical membership storage could not be verified';end if;
 perform cc_private.school_lock(actor);
 perform 1 from public.cc_records where owner_id=actor and id in ((p_task->>'recordId')::uuid,(p_project->>'recordId')::uuid) order by id for update;
 select * into t from public.cc_records where id=(p_task->>'recordId')::uuid and owner_id=actor;
 select * into p from public.cc_records where id=(p_project->>'recordId')::uuid and owner_id=actor;
 proposed:=jsonb_build_object('fictional',true,'schemaVersion',1,'task',p_task,'project',p_project);
 if t.version is distinct from p_task_version or p.version is distinct from p_project_version or cc_private.common_task_membership_matches(t,p,actor,proposed,false) is not true then raise exception 'Canonical task or project changed; review again';end if;
 select * into l from public.cc_records where owner_id=actor and item_type='common_task_link' and cc_private.common_task_membership_key(payload->'task',payload->'project')=key for update;
 if coalesce(l.version,0)<>p_link_version then raise exception 'Canonical membership changed; review again';end if;
 if p_linked then
 if l.id is null then
 insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload) values(actor,null,'private','Personal Life','common_task_link','PRIVATE_COOKIE_COMMON_TASK_LINK',proposed) returning * into l;
 elsif l.deleted_at is not null then update public.cc_records set deleted_at=null where id=l.id and owner_id=actor returning * into l;
 else raise exception 'Task already belongs to this project';end if;
 else
 if l.id is null or l.deleted_at is not null then raise exception 'Task does not belong to this project';end if;
 update public.cc_records set deleted_at=statement_timestamp() where id=l.id and owner_id=actor returning * into l;
 end if;
 select * into t from public.cc_records where id=(p_task->>'recordId')::uuid and owner_id=actor;
 select * into p from public.cc_records where id=(p_project->>'recordId')::uuid and owner_id=actor;
 return jsonb_build_object('taskId',t.id,'taskVersion',t.version,'projectId',p.id,'projectVersion',p.version,'linkRecord',to_jsonb(l));
end$$;
-- One SQL call owns ordinary completion plus both membership families.
create function public.cc_complete_common_recurring_chore(p_record_id uuid,p_version integer,p_schedule jsonb,p_next_day date,p_review_day date,p_operation_id uuid,p_successor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;l public.cc_records%rowtype;source public.cc_records%rowtype;successor public.cc_records%rowtype;counted integer:=0;
begin
 if actor is null or not cc_private.development_session_active() then raise exception 'Active recurring membership session required';end if;
 if public.cc_private_common_task_links_ready() is not true then raise exception 'Canonical membership storage could not be verified';end if;
 perform cc_private.school_lock(actor);
 result:=public.cc_complete_recurring_chore(p_record_id,p_version,p_schedule,p_next_day,p_review_day,p_operation_id,p_successor_id);
 if result->'alreadySaved'='true'::jsonb then
 select count(*) into counted from public.cc_records where owner_id=actor and item_type='common_task_link' and deleted_at is null and payload->'task'->>'kind'='task' and lower(payload->'task'->>'recordId')=p_successor_id::text;
 return result||jsonb_build_object('commonProjectLinkCount',counted);
 end if;
 for l in select * from public.cc_records where owner_id=actor and item_type='common_task_link' and deleted_at is null and payload->'task'->>'kind'='task' and lower(payload->'task'->>'recordId')=p_record_id::text order by cc_private.common_task_reference_key(payload->'project',false),id loop
 insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload)
 values(actor,null,'private','Personal Life','common_task_link','PRIVATE_COOKIE_COMMON_TASK_LINK',jsonb_build_object('fictional',true,'schemaVersion',1,'task',jsonb_build_object('kind','task','recordId',p_successor_id::text),'project',l.payload->'project'));
 counted:=counted+1;
 end loop;
 select * into source from public.cc_records where id=p_record_id and owner_id=actor;
 select * into successor from public.cc_records where id=p_successor_id and owner_id=actor;
 return result||jsonb_build_object('completedRecord',to_jsonb(source),'nextRecord',to_jsonb(successor),'commonProjectLinkCount',counted);
end$$;
revoke all on function cc_private.common_task_link_guard(),cc_private.common_task_touch_source(),cc_private.common_task_manual_limit(),cc_private.common_task_protect_sources(),cc_private.common_task_recurring_carry_guard() from public,anon,authenticated;
revoke all on function public.cc_complete_common_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid),public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean) from public,anon;
grant execute on function public.cc_complete_common_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid),public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean) to authenticated;

-- OFFLINE PREPARATION ONLY. Non-persistent private input view, not a public RPC.
-- Restore links only when every affected task source is new in this transaction.

create view cc_private.restore_new_task_graph with(security_invoker=true,security_barrier=true) as select null::jsonb as payload where false;
create function cc_private.restore_new_task_graph() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();records jsonb;value jsonb;r public.cc_records%rowtype;ids uuid[]:='{}';sources uuid[]:='{}';result jsonb:='[]';source_id uuid;
begin
 if actor is null or not cc_private.development_session_active() or public.cc_private_common_task_links_ready() is not true then raise exception 'Verified private graph recovery context required';end if;
 if jsonb_typeof(new.payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(new.payload))<>1 or not(new.payload?'records') or jsonb_typeof(new.payload->'records') is distinct from 'array' then raise exception 'Exact reviewed recovery graph required';end if;
 records:=new.payload->'records';if jsonb_array_length(records)>2000 or octet_length(convert_to(new.payload::text,'UTF8'))>6291456 then raise exception 'Recovery graph exceeds its reviewed bound';end if;
 perform cc_private.school_lock(actor);
 lock table public.cc_records in share row exclusive mode nowait;
 for value in select v from jsonb_array_elements(records) v loop
 if jsonb_typeof(value) is distinct from 'object' or (select count(*) from jsonb_object_keys(value))<>12 or not(value?&array['id','owner_id','household_id','visibility','section','item_type','origin','payload','version','deleted_at','created_at','updated_at']) then raise exception 'Complete preserved recovery metadata required';end if;
 r:=jsonb_populate_record(null::public.cc_records,value);
 if r.id is null or value->>'id' is distinct from r.id::text or r.id=any(ids) or r.owner_id is distinct from actor
 or r.visibility is distinct from 'private' or r.household_id is not null or r.deleted_at is not null
 or r.version is null or r.version<1 or r.created_at is null or r.updated_at is null or not isfinite(r.created_at) or not isfinite(r.updated_at)
 or r.section not in ('Home','Calendar','Personal Life','Work','School','Finances') or r.origin is null or length(r.origin) not between 1 and 500
 or r.item_type not in ('note','task','project','school_fixture','project_task_link','common_task_link') or jsonb_typeof(r.payload) is distinct from 'object' or r.payload->'fictional' is distinct from 'true'::jsonb then raise exception 'Supported new owned private source required';end if;
 ids:=array_append(ids,r.id);if r.item_type not in ('project_task_link','common_task_link') then sources:=array_append(sources,r.id);end if;
 end loop;
 if exists(select 1 from public.cc_records where id=any(ids)) then raise exception 'Recovery graph cannot overwrite existing identities';end if;
 -- Both membership families normally advance their task source. Only fresh,
 -- invisible-to-other-sessions sources may enter this nested insertion context.
 for value in select v from jsonb_array_elements(records) v where v->>'item_type' in ('project_task_link','common_task_link') loop
 if value->>'item_type'='project_task_link' then source_id:=(value->'payload'->>'taskId')::uuid;
 else source_id:=(value->'payload'->'task'->>'recordId')::uuid;end if;
 if source_id is null or not(source_id=any(sources)) then raise exception 'Existing task sources require a separate reviewed reconciliation';end if;
 end loop;
 -- Separate INSERT statements make dependency order explicit to all invoker guards.
 for value in select v from jsonb_array_elements(records) with ordinality q(v,n)
 order by case when v->>'item_type'='school_fixture' and v->'payload'->>'kind'='degree' then 0 when v->>'item_type'='school_fixture' then 1 when v->>'item_type' in ('project_task_link','common_task_link') then 3 else 2 end,n loop
 r:=jsonb_populate_record(null::public.cc_records,value);
 insert into public.cc_records select (r).*;
 end loop;
 for r in select * from public.cc_records where id=any(ids) and owner_id=actor and visibility='private' and household_id is null order by id loop result:=result||jsonb_build_array(to_jsonb(r));end loop;
 if jsonb_array_length(result)<>jsonb_array_length(records) then raise exception 'Restored graph acknowledgement is incomplete';end if;
 new.payload:=jsonb_build_object('records',result);return new;
end$$;
create trigger cc_restore_new_task_graph instead of insert on cc_private.restore_new_task_graph for each row execute function cc_private.restore_new_task_graph();
revoke all on cc_private.restore_new_task_graph from public,anon,authenticated;
grant select,insert on cc_private.restore_new_task_graph to authenticated;
revoke all on function cc_private.restore_new_task_graph() from public,anon,authenticated;
-- Generated exact source/catalog binding. No record data, secrets or automatic installation.
create function public.cc_private_common_task_links_ready() returns boolean language sql stable security invoker set search_path='' as $$
select coalesce(public.cc_private_school_recovery_ready(),false)
 and not exists(select 1 from(values ('cc_private.common_task_reference_key(jsonb,boolean)','855e2922dfc15a31aa6aa80f2013dd1c',true,'text','i','plpgsql',array['p_reference','p_task']::text[],0,null,false),
('cc_private.common_task_membership_key(jsonb,jsonb)','d536d955da7709d1f611fa6fb9b45a7c',true,'text','i','plpgsql',array['p_task','p_project']::text[],0,null,false),
('cc_private.common_task_trim(text)','8176cfe8f78c9b7ee521928aa6a367c3',true,'text','i','sql',array['v']::text[],0,null,false),
('cc_private.common_task_endpoint_matches(public.cc_records,uuid,jsonb,boolean,boolean)','85cd90973a793851d27624faed34e5f9',true,'boolean','s','plpgsql',array['p_row','p_owner','p_reference','p_task','p_history']::text[],1,'false',false),
('cc_private.common_task_intrinsic(public.cc_records,jsonb,jsonb)','a4b39eb22046816ce1b0cec943003f4a',true,'boolean','i','sql',array['p_task_row','p_task','p_project']::text[],0,null,false),
('cc_private.common_task_membership_matches(public.cc_records,public.cc_records,uuid,jsonb,boolean)','6ac8376889abf409e29e7a384475a805',true,'boolean','s','plpgsql',array['p_task_row','p_project_row','p_owner','p_payload','p_history']::text[],1,'false',false),
('cc_private.common_task_link_guard()','7c97241d8ed04a429b786732cad103fd',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_touch_source()','d7b096fc56434fcb1d986e145f8881be',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_manual_limit()','c2234e580386c287c4b27b3b2edcc69b',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_protect_sources()','13a0945030d6836a67ba32e312c76c49',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_recurring_carry_guard()','aa5b6bfaa780a3aba53fd8086414e1cd',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean)','3eebe314e57c5001777abe5206fa3d40',true,'jsonb','v','plpgsql',array['p_task','p_task_version','p_project','p_project_version','p_link_version','p_linked']::text[],0,null,false),
('public.cc_complete_common_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid)','8732f679655e4300ebba97a6b642a6c7',true,'jsonb','v','plpgsql',array['p_record_id','p_version','p_schedule','p_next_day','p_review_day','p_operation_id','p_successor_id']::text[],0,null,false),
('public.cc_private_school_recovery_ready()','851c3a9c9442f114911f24e2e7da0216',true,'boolean','s','sql',array[]::text[],0,null,false),
('cc_private.validate_project_task_link()','f040a387f1dd3b53851a0474842bcadf',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.touch_linked_task()','f7b935c39f53f9da91c38ba32dbc86d6',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.protect_link_targets()','1d3f12202ff11f58bc9e3c2ba6a622ef',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('public.cc_set_task_project_link(uuid,integer,uuid,integer,integer,boolean)','b250e12d738d29559438e29ea7eac2a4',true,'jsonb','v','plpgsql',array['p_task_id','p_task_version','p_project_id','p_project_version','p_link_version','p_linked']::text[],0,null,false),
('public.cc_complete_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid)','cc3830f8d2238be528b4ac551f6b37d1',true,'jsonb','v','plpgsql',array['p_record_id','p_version','p_schedule','p_next_day','p_review_day','p_operation_id','p_successor_id']::text[],0,null,false),
('cc_private.recurring_chore_day(date,text,integer,integer)','2df1bfe850ef468c5dca73c292566a6e',true,'date','i','plpgsql',array['anchor','frequency','every_n','ordinal']::text[],0,null,false),
('cc_private.recurring_chore_plan(jsonb,date,date)','0600fbb44d4546c79124f811ab1339e4',true,'jsonb','i','plpgsql',array['schedule','due_day','completed_on']::text[],0,null,false),
('cc_private.restore_new_task_graph()','c2a1937dc61d727a46406953ce18fa5c',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)','01d21a3de25ea375cb983b1eb152a5db',true,'jsonb','v','plpgsql',array['p_parent_project_id','p_parent_version','p_child_project_id','p_child_version','p_link_version','p_linked']::text[],0,null,true)) expected(signature,body_hash,authenticated_execute,result_type,volatility,language,arg_names,default_count,defaults,optional)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where (p.oid is null and not expected.optional) or (p.oid is not null and (pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef or p.prokind<>'f'
 or p.proconfig is distinct from array['search_path=""']::text[]
 or p.prorettype<>pg_catalog.to_regtype(expected.result_type) or p.provolatile::text<>expected.volatility
 or p.prolang<>(select oid from pg_catalog.pg_language where lanname=expected.language)
 or coalesce(p.proargnames,array[]::text[]) is distinct from expected.arg_names
 or p.pronargdefaults<>expected.default_count or pg_catalog.pg_get_expr(p.proargdefaults,0) is distinct from expected.defaults
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)))
 and(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in('cc_private.common_task_reference_key','cc_private.common_task_membership_key','cc_private.common_task_trim','cc_private.common_task_endpoint_matches','cc_private.common_task_intrinsic','cc_private.common_task_membership_matches','cc_private.common_task_link_guard','cc_private.common_task_touch_source','cc_private.common_task_manual_limit','cc_private.common_task_protect_sources','cc_private.common_task_recurring_carry_guard','public.cc_set_common_task_link','public.cc_complete_common_recurring_chore','public.cc_private_school_recovery_ready','cc_private.validate_project_task_link','cc_private.touch_linked_task','cc_private.protect_link_targets','public.cc_set_task_project_link','public.cc_complete_recurring_chore','cc_private.recurring_chore_day','cc_private.recurring_chore_plan','cc_private.restore_new_task_graph','public.cc_set_project_hierarchy_link'))=22+case when pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') is null then 0 else 1 end
 and not exists(select 1 from(values ('cc_validate_project_task_link','cc_private.validate_project_task_link()',23,false),
('cc_touch_linked_task','cc_private.touch_linked_task()',21,false),
('cc_protect_link_targets','cc_private.protect_link_targets()',19,false),
('cc_common_task_link_guard','cc_private.common_task_link_guard()',31,false),
('cc_common_task_touch_source','cc_private.common_task_touch_source()',21,false),
('cc_common_task_manual_limit','cc_private.common_task_manual_limit()',23,false),
('cc_common_task_protect_sources','cc_private.common_task_protect_sources()',27,false),
('cc_common_task_recurring_carry_guard','cc_private.common_task_recurring_carry_guard()',17,true)) expected(name,signature,type,deferred)
 left join pg_catalog.pg_trigger t on t.tgrelid='public.cc_records'::regclass and t.tgname=expected.name
 where t.oid is null or t.tgisinternal or t.tgenabled<>'O' or t.tgqual is not null or t.tgattr<>''::int2vector or t.tgnargs<>0
 or t.tgtype<>expected.type or t.tgfoid<>pg_catalog.to_regprocedure(expected.signature)
 or t.tgdeferrable is distinct from expected.deferred or t.tginitdeferred is distinct from expected.deferred
 or (t.tgconstraint<>0) is distinct from expected.deferred)
 and exists(select 1 from pg_catalog.pg_class v where v.oid=pg_catalog.to_regclass('cc_private.restore_new_task_graph') and v.relkind='v'
 and 'security_invoker=true'=any(v.reloptions) and 'security_barrier=true'=any(v.reloptions) and cardinality(v.reloptions)=2
 and pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.pg_get_viewdef(v.oid),'[[:space:]]+',' ','g'))='SELECT NULL::jsonb AS payload WHERE false;'
 and(select count(*) from pg_catalog.pg_attribute a where a.attrelid=v.oid and a.attnum>0 and not a.attisdropped)=1
 and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=v.oid and a.attnum=1 and a.attname='payload' and a.atttypid='jsonb'::regtype and not a.attisdropped)
 and(select count(*) from pg_catalog.pg_rewrite r where r.ev_class=v.oid)=1
 and not pg_catalog.has_table_privilege('anon',v.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and pg_catalog.has_table_privilege('authenticated',v.oid,'SELECT') and pg_catalog.has_table_privilege('authenticated',v.oid,'INSERT')
 and not pg_catalog.has_table_privilege('authenticated',v.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and(select count(*) from pg_catalog.pg_trigger t where t.tgrelid=v.oid and not t.tgisinternal)=1
 and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid=v.oid and t.tgname='cc_restore_new_task_graph' and not t.tgisinternal
 and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and t.tgtype=69
 and t.tgfoid=pg_catalog.to_regprocedure('cc_private.restore_new_task_graph()') and not t.tgdeferrable and not t.tginitdeferred))
 and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam
 where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_private_task_project') and i.indrelid='public.cc_records'::regclass
 and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and not i.indnullsnotdistinct and i.indnkeyatts=3 and i.indnatts=3 and am.amname='btree'
 and pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='owner_id'
 and pg_catalog.pg_get_expr(i.indexprs,i.indrelid)='(payload ->> ''taskId''::text), (payload ->> ''projectId''::text)'
 and pg_catalog.pg_get_expr(i.indpred,i.indrelid)='(item_type = ''project_task_link''::text)'
 and i.indclass[0]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='uuid_ops' and a.amname='btree')
 and i.indclass[1]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='text_ops' and a.amname='btree')
 and i.indclass[2]=i.indclass[1])
 and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam
 where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_common_task_pair') and i.indrelid='public.cc_records'::regclass
 and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and not i.indnullsnotdistinct and i.indnkeyatts=2 and i.indnatts=2 and am.amname='btree'
 and pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='owner_id'
 and pg_catalog.pg_get_expr(i.indexprs,i.indrelid)='cc_private.common_task_membership_key((payload -> ''task''::text), (payload -> ''project''::text))'
 and pg_catalog.pg_get_expr(i.indpred,i.indrelid)='(item_type = ''common_task_link''::text)'
 and i.indclass[0]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='uuid_ops' and a.amname='btree')
 and i.indclass[1]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='text_ops' and a.amname='btree'));
$$;
revoke all on function public.cc_private_common_task_links_ready() from public,anon,authenticated;
grant execute on function public.cc_private_common_task_links_ready() to authenticated;
commit;
