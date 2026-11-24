-- UNAPPLIED, unmounted candidate. Requires private_record_versions.sql and the
-- existing private task-link/hierarchy contracts in isolated acceptance only.
-- Service-only calls are intended for a future server route after it has run the
-- original user/session/review checks. This file is not a live migration.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

create table cc_private.operation_receipts(
 owner_id uuid not null references auth.users(id),
 operation_id uuid not null,
 record_id uuid not null,
 item_type text not null check(item_type in('task','project')),
 source_origin text not null,
 operation text not null check(operation in('task.edit','project.edit','task.undo','project.undo')),
 expected_version integer not null check(expected_version>0),
 result_version integer not null check(result_version=expected_version+1),
 history_id uuid not null references cc_private.record_versions(id),
 relationship_snapshot jsonb not null check(jsonb_typeof(relationship_snapshot)='array'),
 target_operation_id uuid,
 created_at timestamptz not null default statement_timestamp(),
 primary key(owner_id,operation_id),
 unique(owner_id,record_id,result_version),
 check((operation like '%.undo')=(target_operation_id is not null))
);
create index cc_operation_receipts_source on cc_private.operation_receipts(owner_id,record_id,result_version desc);
alter table cc_private.operation_receipts enable row level security;
revoke all on cc_private.operation_receipts from public,anon,authenticated;
create function cc_private.immutable_operation_receipt() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Operation receipts cannot be edited or deleted directly';end$$;
revoke all on function cc_private.immutable_operation_receipt() from public,anon,authenticated;
create trigger cc_immutable_operation_receipt before update or delete on cc_private.operation_receipts for each row execute function cc_private.immutable_operation_receipt();

create function cc_private.operation_relationship_snapshot(p_owner uuid,p_type text,p_record uuid)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'item_type',r.item_type,'payload',r.payload,'deleted_at',r.deleted_at) order by r.id),'[]'::jsonb)
 from public.cc_records r where r.owner_id=p_owner and r.visibility='private' and r.household_id is null and (
  p_type='task' and r.item_type='project_task_link' and r.payload->>'taskId'=p_record::text
  or p_type='project' and (
   r.item_type='project_task_link' and r.payload->>'projectId'=p_record::text
   or r.item_type='project_project_link' and (r.payload->>'parentProjectId'=p_record::text or r.payload->>'childProjectId'=p_record::text)
  )
 )
$$;
revoke all on function cc_private.operation_relationship_snapshot(uuid,text,uuid) from public,anon,authenticated;
grant execute on function cc_private.operation_relationship_snapshot(uuid,text,uuid) to service_role;

create function public.cc_commit_private_operation(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;session_key uuid;operation_key uuid;source_id uuid;kind text;target_key uuid;expected integer;source_row public.cc_records%rowtype;prior cc_private.operation_receipts%rowtype;history_row cc_private.record_versions%rowtype;relations jsonb;proposed jsonb;mutable_keys text[];after_row public.cc_records%rowtype;receipt cc_private.operation_receipts%rowtype;before_history_count integer;
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Private operation adapter required';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>9
 or not(p_input ?& array['ownerId','sessionId','operationId','kind','recordId','expectedVersion','section','payload','expectedRelationships']) then raise exception 'Exact reviewed operation required';end if;
 actor:=(p_input->>'ownerId')::uuid;session_key:=(p_input->>'sessionId')::uuid;operation_key:=(p_input->>'operationId')::uuid;source_id:=(p_input->>'recordId')::uuid;kind:=p_input->>'kind';expected:=(p_input->>'expectedVersion')::integer;proposed:=p_input->'payload';
 if actor is null or session_key is null or operation_key is null or source_id is null or expected is null or expected<1
 or kind not in('task.edit','project.edit') or jsonb_typeof(proposed) is distinct from 'object' or jsonb_typeof(p_input->'expectedRelationships') is distinct from 'array'
 or not exists(select 1 from auth.sessions s where s.id=session_key and s.user_id=actor) then raise exception 'Verified private session and edit required';end if;
 -- Serialize duplicate requests with the same owner-scoped operation ID so a
 -- concurrent retry observes the committed receipt instead of a stale version.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||operation_key::text,0));
 select * into prior from cc_private.operation_receipts where owner_id=actor and operation_id=operation_key;
 if found then
  if prior.record_id<>source_id or prior.expected_version<>expected or prior.operation<>kind or prior.relationship_snapshot<>p_input->'expectedRelationships' then raise exception 'Operation identity conflicts with an earlier request';end if;
  select * into source_row from public.cc_records where id=source_id and owner_id=actor and visibility='private' and household_id is null and item_type=prior.item_type and origin=prior.source_origin;
  if not found then raise exception 'Saved operation source is unavailable';end if;
  if source_row.version=prior.result_version then
   if source_row.payload<>proposed or source_row.section<>p_input->>'section' then raise exception 'Operation replay differs from its saved result';end if;
  else
   select * into history_row from cc_private.record_versions where owner_id=actor and record_id=source_id and source_version=prior.result_version and item_type=prior.item_type order by captured_at desc,id desc limit 1;
   if not found or history_row.snapshot->'payload'<>proposed or history_row.snapshot->>'section' is distinct from p_input->>'section' then raise exception 'Operation replay no longer matches a retained result';end if;
  end if;
  return jsonb_build_object('operationId',operation_key,'recordId',source_id,'resultVersion',prior.result_version,'historyId',prior.history_id,'replayed',true);
 end if;
 select * into source_row from public.cc_records where id=source_id and owner_id=actor and visibility='private' and household_id is null and deleted_at is null and item_type=split_part(kind,'.',1) for update;
 if not found or source_row.version<>expected or source_row.section is distinct from p_input->>'section' then raise exception 'Private source changed; review again';end if;
 if not ((source_row.origin='CC_MANUAL_WORKSPACE' and source_row.payload->>'source'='manual' and source_row.payload->'fictional'='false'::jsonb and source_row.payload->'schemaVersion'='1'::jsonb)
  or (source_row.origin='PRIVATE_COOKIE_TASK_CREATE' and source_row.item_type='task' and source_row.payload->'fictional'='true'::jsonb)
  or (source_row.origin='PRIVATE_COOKIE_PROJECT' and source_row.item_type='project' and source_row.payload->'fictional'='true'::jsonb and source_row.payload->'schemaVersion'='1'::jsonb)) then raise exception 'Unsupported or mixed source provenance';end if;
 relations:=cc_private.operation_relationship_snapshot(actor,source_row.item_type,source_id);
 if relations<>p_input->'expectedRelationships' then raise exception 'Source relationships changed; review again';end if;
 if source_row.item_type='task' then
  mutable_keys:=array['title','description','day','priority'];
  if (source_row.payload-'title'-'description'-'day'-'priority')<>(proposed-'title'-'description'-'day'-'priority') then raise exception 'Task lifecycle, recurrence, checklist or extension changed';end if;
  if jsonb_typeof(proposed->'title') is distinct from 'string' or char_length(btrim(proposed->>'title')) not between 1 and 140 or jsonb_typeof(proposed->'done') is distinct from 'boolean' then raise exception 'Supported task text required';end if;
 else
  mutable_keys:=array['title','description','summary','status'];
  if (source_row.payload-'title'-'description'-'summary'-'status')<>(proposed-'title'-'description'-'summary'-'status') then raise exception 'Project progress, hierarchy or extension changed';end if;
  if jsonb_typeof(proposed->'title') is distinct from 'string' or char_length(btrim(proposed->>'title')) not between 1 and 140 then raise exception 'Supported project title required';end if;
 end if;
 if (source_row.origin='CC_MANUAL_WORKSPACE' and (proposed->'fictional'<>'false'::jsonb or proposed->>'source'<>'manual'))
  or (source_row.origin<>'CC_MANUAL_WORKSPACE' and proposed->'fictional'<>'true'::jsonb) then raise exception 'Source discriminator cannot change';end if;
 if exists(select 1 from jsonb_object_keys(proposed) k where k=any(mutable_keys) and jsonb_typeof(proposed->k)='null') then raise exception 'Null text values are unsupported';end if;
 select count(*) into before_history_count from cc_private.record_versions where owner_id=actor and record_id=source_id;
 update public.cc_records set payload=proposed where id=source_id and owner_id=actor and version=expected returning * into after_row;
 if not found then raise exception 'Private source changed; review again';end if;
 if after_row.version<>expected+1 or after_row.payload<>proposed or after_row.origin<>source_row.origin or after_row.section<>source_row.section then raise exception 'Source update acknowledgement differs';end if;
 if cc_private.operation_relationship_snapshot(actor,after_row.item_type,source_id)<>relations then raise exception 'Relationships changed during save';end if;
 select * into history_row from cc_private.record_versions where owner_id=actor and record_id=source_id and source_version=expected and item_type=source_row.item_type order by captured_at desc,id desc limit 1;
 if not found or (select count(*) from cc_private.record_versions where owner_id=actor and record_id=source_id)<>before_history_count+1 then raise exception 'Exact prior history snapshot was not captured';end if;
 insert into cc_private.operation_receipts(owner_id,operation_id,record_id,item_type,source_origin,operation,expected_version,result_version,history_id,relationship_snapshot)
 values(actor,operation_key,source_id,source_row.item_type,source_row.origin,kind,expected,after_row.version,history_row.id,relations) returning * into receipt;
 return jsonb_build_object('operationId',operation_key,'recordId',source_id,'resultVersion',after_row.version,'historyId',history_row.id,'replayed',false);
exception when invalid_text_representation or numeric_value_out_of_range or not_null_violation or foreign_key_violation then raise exception 'Private operation could not be verified';
end$$;
revoke all on function public.cc_commit_private_operation(jsonb) from public,anon,authenticated;
grant execute on function public.cc_commit_private_operation(jsonb) to service_role;

-- Initial candidate supports edits only. Safe Undo will be added only after the
-- edit path and its one-use server approval adapter have isolated acceptance.
commit;
