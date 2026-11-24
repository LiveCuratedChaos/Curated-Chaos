-- Separate development only. Reviewed private task/project membership, no task copies.
begin;
create unique index cc_unique_private_task_project
 on public.cc_records(owner_id,(payload->>'taskId'),(payload->>'projectId'))
 where item_type='project_task_link';
create function cc_private.validate_project_task_link()
returns trigger language plpgsql security invoker set search_path='' as $$
declare task_row public.cc_records%rowtype;project_row public.cc_records%rowtype;
begin
 if new.item_type<>'project_task_link' and (tg_op='INSERT' or old.item_type<>'project_task_link') then return new;end if;
 if tg_op='UPDATE' and (old.item_type<>new.item_type or old.payload<>new.payload or old.origin<>new.origin or old.section<>new.section) then raise exception 'Project link identity is immutable';end if;
 if auth.uid() is null or new.owner_id<>auth.uid() or not cc_private.development_session_active()
 or new.visibility<>'private' or new.household_id is not null or new.section<>'Personal Life' or new.origin is distinct from 'PRIVATE_COOKIE_PROJECT_TASK_LINK'
 or jsonb_typeof(new.payload)<>'object' or (select count(*) from jsonb_object_keys(new.payload))<>4
 or not(new.payload ?& array['fictional','schemaVersion','taskId','projectId'])
 or new.payload->'fictional' is distinct from 'true'::jsonb or new.payload->'schemaVersion' is distinct from '1'::jsonb
 or jsonb_typeof(new.payload->'taskId') is distinct from 'string' or jsonb_typeof(new.payload->'projectId') is distinct from 'string'
 or new.payload->>'taskId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or new.payload->>'projectId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 then raise exception 'Exact private project link required';end if;
 select * into task_row from public.cc_records where id=(new.payload->>'taskId')::uuid and owner_id=new.owner_id and visibility='private' and household_id is null and item_type='task' and (new.deleted_at is not null or deleted_at is null) for update;
 if not found or task_row.payload->'fictional' is distinct from 'true'::jsonb or task_row.section not in ('Home','Personal Life','Work','School') then raise exception 'Supported private task required';end if;
 select * into project_row from public.cc_records where id=(new.payload->>'projectId')::uuid and owner_id=new.owner_id and visibility='private' and household_id is null and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and (new.deleted_at is not null or deleted_at is null) for share;
 if not found or project_row.payload->'fictional' is distinct from 'true'::jsonb or project_row.payload->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Supported private project required';end if;
 if new.deleted_at is null and (select count(*) from public.cc_records where owner_id=new.owner_id and item_type='project_task_link' and payload->>'taskId'=new.payload->>'taskId' and deleted_at is null and id<>new.id)>=50 then raise exception 'Task project limit reached';end if;
 return new;
end $$;
create trigger cc_validate_project_task_link before insert or update on public.cc_records for each row execute function cc_private.validate_project_task_link();
create function cc_private.touch_linked_task()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.item_type='project_task_link' and pg_trigger_depth()=1 and ((tg_op='INSERT' and new.deleted_at is null) or (tg_op='UPDATE' and new.deleted_at is distinct from old.deleted_at)) then
 update public.cc_records set payload=payload where id=(new.payload->>'taskId')::uuid and owner_id=new.owner_id;
 end if;return new;
end $$;
create trigger cc_touch_linked_task after insert or update on public.cc_records for each row execute function cc_private.touch_linked_task();
create function cc_private.protect_link_targets()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.item_type in ('task','project') and exists(select 1 from public.cc_records where owner_id=old.owner_id and item_type='project_task_link' and deleted_at is null and payload->>(case when old.item_type='task' then 'taskId' else 'projectId' end)=old.id::text) then
 if new.item_type<>old.item_type then raise exception 'Unlink project membership before changing record type';end if;
 if old.deleted_at is null and new.deleted_at is not null then
 if old.item_type='project' then raise exception 'Unlink tasks before removing a project';end if;
 update public.cc_records set deleted_at=new.deleted_at where owner_id=old.owner_id and item_type='project_task_link' and deleted_at is null and payload->>'taskId'=old.id::text;
 end if;end if;return new;
end $$;
create trigger cc_protect_link_targets before update on public.cc_records for each row execute function cc_private.protect_link_targets();
create function public.cc_set_task_project_link(p_task_id uuid,p_task_version integer,p_project_id uuid,p_project_version integer,p_link_version integer,p_linked boolean)
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
revoke all on function cc_private.validate_project_task_link(),cc_private.touch_linked_task(),cc_private.protect_link_targets() from public,anon,authenticated;
revoke all on function public.cc_set_task_project_link(uuid,integer,uuid,integer,integer,boolean) from public,anon;
grant execute on function public.cc_set_task_project_link(uuid,integer,uuid,integer,integer,boolean) to authenticated;

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

commit;
