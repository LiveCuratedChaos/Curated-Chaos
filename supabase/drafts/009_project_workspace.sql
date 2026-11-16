-- UNAPPLIED: manual project/task workflow. Review and explicit database approval
-- required. Reuses 001 cc_records and its version trigger; touches no old rows.
begin;
create schema if not exists cc_workspace_private;
revoke all on schema cc_workspace_private from public, anon, authenticated;
create table cc_workspace_private.actors (
 owner_id uuid primary key references auth.users(id)
);
create table cc_workspace_private.operations (
 owner_id uuid not null references auth.users(id),
 operation_id uuid not null,
 intent jsonb not null,
 kind text not null check(kind in ('create','update','undo')),
 record_id uuid not null references public.cc_records(id),
 before_record jsonb,
 after_record jsonb not null,
 target_operation_id uuid,
 created_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,operation_id)
);
alter table cc_workspace_private.actors enable row level security;
alter table cc_workspace_private.operations enable row level security;
revoke all on cc_workspace_private.actors,cc_workspace_private.operations from public,anon,authenticated;
create index cc_workspace_operations_history on cc_workspace_private.operations(owner_id,record_id,created_at desc);

-- Existing authenticated grants on cc_records must not bypass the server-only
-- manual workflow. Invoker trigger sees the RPC definer identity for RPC calls;
-- direct authenticated writes are rejected without changing legacy records.
create function cc_workspace_private.guard_manual_records()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('anon','authenticated') and
    ((tg_op<>'DELETE' and new.origin='CC_MANUAL_WORKSPACE') or
     (tg_op<>'INSERT' and old.origin='CC_MANUAL_WORKSPACE')) then
  raise exception 'PROJECT_WORKSPACE_INVALID';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function cc_workspace_private.guard_manual_records() from public,anon,authenticated;
create trigger cc_manual_workspace_guard before insert or update or delete on public.cc_records
 for each row execute function cc_workspace_private.guard_manual_records();

-- Validates complete payloads, not browser patches. Unknown existing extensions
-- must remain byte-for-byte JSON equivalent; create accepts known fields only.
create function cc_workspace_private.validate_payload(kind text,p jsonb,previous jsonb default null)
returns void language plpgsql set search_path='' as $$
declare editable text[]; field text; entry jsonb; seen text[] := '{}'; day_value text; prior_entry jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or p->'schemaVersion' is distinct from '1'::jsonb or p->'source' is distinct from '"manual"'::jsonb or p->'fictional' is distinct from 'false'::jsonb then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 if kind='project' then editable:=array['title','summary','status'];
 elsif kind='task' then editable:=array['title','description','day','status','priority','project_id','subtasks','done'];
 else raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 if previous is null then
  if (p - editable - array['schemaVersion','source','fictional']) <> '{}'::jsonb then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 else
  if (p - editable) is distinct from (previous - editable) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 end if;
 if jsonb_typeof(p->'title') is distinct from 'string' or (char_length(btrim(p->>'title'))=0 or char_length(p->>'title')>140) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 if kind='project' then
  if jsonb_typeof(p->'summary') is distinct from 'string' or char_length(p->>'summary')>10000 or not coalesce(p->>'status'=any(array['Planned','In Progress','On Hold','Completed','Cancelled']),false) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 else
  if jsonb_typeof(p->'description') is distinct from 'string' or char_length(p->>'description')>10000 or not coalesce(p->>'status'=any(array['Not Started','In Progress','Waiting','On Hold','Completed']),false) or not coalesce(p->>'priority'=any(array['Low','Normal','High','Urgent']),false) or p->'done' is distinct from to_jsonb(p->>'status'='Completed') then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  if not p ? 'day' or not p ? 'project_id' then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  if p->'day'<>'null'::jsonb then
   day_value:=p->>'day';
   if jsonb_typeof(p->'day')<>'string' or day_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or left(day_value,4)::integer not between 2000 and 2100 then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
   begin if to_char(day_value::date,'YYYY-MM-DD')<>day_value then raise exception 'PROJECT_WORKSPACE_INVALID'; end if; exception when others then raise exception 'PROJECT_WORKSPACE_INVALID'; end;
  end if;
  if p->'project_id'<>'null'::jsonb and (jsonb_typeof(p->'project_id')<>'string' or p->>'project_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  if jsonb_typeof(p->'subtasks') is distinct from 'array' then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  if jsonb_array_length(p->'subtasks')>40 then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  for entry in select value from jsonb_array_elements(p->'subtasks') loop
   if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'id') is distinct from 'string' or entry->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or lower(entry->>'id')=any(seen) or jsonb_typeof(entry->'title') is distinct from 'string' or (char_length(btrim(entry->>'title'))=0 or char_length(entry->>'title')>140) or jsonb_typeof(entry->'done') is distinct from 'boolean' then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
   prior_entry:=null;
   if previous is not null then
    select value into prior_entry from jsonb_array_elements(previous->'subtasks') where lower(value->>'id')=lower(entry->>'id') limit 1;
   end if;
   if (entry-array['id','title','done']) is distinct from coalesce(prior_entry-array['id','title','done'],'{}'::jsonb) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
   seen:=array_append(seen,lower(entry->>'id'));
  end loop;
 end if;
end $$;
revoke all on function cc_workspace_private.validate_payload(text,jsonb,jsonb) from public,anon,authenticated;

create function public.cc_project_workspace(operation text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op uuid; target uuid; r public.cc_records; before_value jsonb; after_value jsonb; proposed jsonb; intent_value jsonb; saved cc_workspace_private.operations; target_row cc_workspace_private.operations; rows_value jsonb; count_value integer; offset_value integer; revision_value bigint;
begin
 if jsonb_typeof(input) is distinct from 'object' or input->>'ownerId' is null then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 actor:=(input->>'ownerId')::uuid;
 if operation='replay' then
  if input->>'operationId' is null or not coalesce(input->>'kind'=any(array['create','update','undo']),false) or jsonb_typeof(input->'intent') is distinct from 'object' or input->'intent'->>'ownerId' is distinct from actor::text or input->'intent' ? 'operationId' then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  select * into saved from cc_workspace_private.operations where owner_id=actor and operation_id=(input->>'operationId')::uuid;
  if not found then return null; end if;
  if saved.intent is distinct from jsonb_build_object('operation',input->>'kind','input',input->'intent') then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
  return jsonb_build_object('record',saved.after_record,'operationId',saved.operation_id,'replayed',true);
 end if;
 if operation='list' then
  if input->>'limit' is distinct from '50' or input->>'offset' is null then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  offset_value:=(input->>'offset')::integer;
  if offset_value<0 or offset_value>2000 or offset_value%50<>0 then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  insert into cc_workspace_private.actors(owner_id) values(actor) on conflict do nothing;
  perform 1 from cc_workspace_private.actors where owner_id=actor for update;
  select count(*) into revision_value from cc_workspace_private.operations where owner_id=actor;
  if input ? 'revision' and (input->>'revision')::bigint is distinct from revision_value then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
  if offset_value>0 and not input ? 'revision' then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at,v.id),'[]'::jsonb),count(*) into rows_value,count_value from (select * from public.cc_records where owner_id=actor and visibility='private' and household_id is null and deleted_at is null and origin='CC_MANUAL_WORKSPACE' and item_type in ('project','task') and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb order by created_at,id offset offset_value limit 51) v;
  return jsonb_build_object('rows',case when count_value>50 then rows_value-50 else rows_value end,'revision',revision_value,'hasMore',count_value>50);
 elsif operation='history' then
  if not exists(select 1 from public.cc_records where id=(input->>'id')::uuid and owner_id=actor and visibility='private' and household_id is null and origin='CC_MANUAL_WORKSPACE' and item_type in ('project','task') and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  select coalesce(jsonb_agg(v.summary order by v.result_version desc),'[]'::jsonb) into rows_value from (select jsonb_build_object('operationId',operation_id,'recordId',record_id,'kind',kind,'resultVersion',(after_record->>'version')::integer,'createdAt',created_at,'targetOperationId',target_operation_id) summary,(after_record->>'version')::integer result_version from cc_workspace_private.operations where owner_id=actor and record_id=(input->>'id')::uuid order by (after_record->>'version')::integer desc limit 100) v;
  return rows_value;
 end if;
 if operation not in ('create','update','undo') or input->>'operationId' is null then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 op:=(input->>'operationId')::uuid;
 -- Serializes actor mutations and project-link changes without locking other users.
 insert into cc_workspace_private.actors(owner_id) values(actor) on conflict do nothing;
 perform 1 from cc_workspace_private.actors where owner_id=actor for update;
 intent_value:=jsonb_build_object('operation',operation,'input',input-'operationId');
 select * into saved from cc_workspace_private.operations where owner_id=actor and operation_id=op;
 if found then
  if saved.intent is distinct from intent_value then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
  return jsonb_build_object('record',saved.after_record,'operationId',op,'replayed',true);
 end if;
 if operation='create' then
  proposed:=input->'record';
  if jsonb_typeof(proposed) is distinct from 'object' or (proposed - array['id','owner_id','household_id','visibility','section','item_type','origin','payload'])<>'{}'::jsonb or proposed->>'owner_id' is distinct from actor::text or proposed->'household_id' is distinct from 'null'::jsonb or proposed->>'visibility' is distinct from 'private' or proposed->>'origin' is distinct from 'CC_MANUAL_WORKSPACE' or not coalesce(proposed->>'section'=any(array['Home','Personal Life','Work','School']),false) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  perform cc_workspace_private.validate_payload(proposed->>'item_type',proposed->'payload');
  insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload) values(actor,null,'private',proposed->>'section',proposed->>'item_type','CC_MANUAL_WORKSPACE',proposed->'payload') returning * into r;
 elsif operation='update' then
  select * into r from public.cc_records where id=(input->>'id')::uuid and owner_id=actor and visibility='private' and household_id is null and deleted_at is null and origin='CC_MANUAL_WORKSPACE' and item_type in ('project','task') and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb for update;
  if not found then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  if r.version is distinct from (input->>'expectedVersion')::integer then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
  before_value:=to_jsonb(r);
  perform cc_workspace_private.validate_payload(r.item_type,input->'payload',r.payload);
  update public.cc_records set payload=input->'payload' where id=r.id returning * into r;
 else
  target:=(input->>'targetOperationId')::uuid;
  select * into target_row from cc_workspace_private.operations where owner_id=actor and operation_id=target;
  if not found then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  select * into r from public.cc_records where id=target_row.record_id and owner_id=actor and visibility='private' and household_id is null and origin='CC_MANUAL_WORKSPACE' and item_type in ('project','task') and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb for update;
  if not found then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
  if r.version is distinct from (target_row.after_record->>'version')::integer then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
  before_value:=to_jsonb(r);
  if target_row.before_record is null then
   if r.item_type='project' and exists(select 1 from public.cc_records where owner_id=actor and visibility='private' and household_id is null and deleted_at is null and origin='CC_MANUAL_WORKSPACE' and item_type='task' and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb and payload->>'project_id'=r.id::text) then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
   update public.cc_records set deleted_at=clock_timestamp() where id=r.id returning * into r;
  else
   perform cc_workspace_private.validate_payload(r.item_type,target_row.before_record->'payload',target_row.before_record->'payload');
   update public.cc_records set payload=target_row.before_record->'payload',deleted_at=(target_row.before_record->>'deleted_at')::timestamptz where id=r.id returning * into r;
  end if;
 end if;
 -- Applies to creation, changes and inverse edits. Completed/cancelled projects
 -- remain live records; deleted or foreign/legacy projects can never be linked.
 if r.item_type='task' and r.deleted_at is null and r.payload->>'project_id' is not null then
  if not exists(select 1 from public.cc_records where id=(r.payload->>'project_id')::uuid and owner_id=actor and section=r.section and visibility='private' and household_id is null and deleted_at is null and origin='CC_MANUAL_WORKSPACE' and item_type='project' and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb) then raise exception 'PROJECT_WORKSPACE_INVALID'; end if;
 end if;
 if r.item_type='project' and r.deleted_at is not null and exists(select 1 from public.cc_records where owner_id=actor and visibility='private' and household_id is null and deleted_at is null and origin='CC_MANUAL_WORKSPACE' and item_type='task' and payload @> '{"schemaVersion":1,"source":"manual","fictional":false}'::jsonb and payload->>'project_id'=r.id::text) then raise exception 'PROJECT_WORKSPACE_CONFLICT'; end if;
 after_value:=to_jsonb(r);
 insert into cc_workspace_private.operations(owner_id,operation_id,intent,kind,record_id,before_record,after_record,target_operation_id) values(actor,op,intent_value,operation,r.id,before_value,after_value,target);
 return jsonb_build_object('record',after_value,'operationId',op,'replayed',false);
exception when invalid_text_representation or numeric_value_out_of_range or not_null_violation or foreign_key_violation then raise exception 'PROJECT_WORKSPACE_INVALID';
end $$;
revoke all on function public.cc_project_workspace(text,jsonb) from public,anon,authenticated;
grant execute on function public.cc_project_workspace(text,jsonb) to service_role;
commit;
