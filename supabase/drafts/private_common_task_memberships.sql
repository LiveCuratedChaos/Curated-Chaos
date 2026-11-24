-- OFFLINE PREPARATION ONLY. Do not install/enable before recurrence, restore and readiness integration.
-- Existing manual membership representations are preserved; no data rewrites or task copies.
begin;
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
commit;
