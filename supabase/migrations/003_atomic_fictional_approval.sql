-- PREPARED ONLY / ISOLATED DEVELOPMENT PROJECT. Owner approval required before execution.
-- No real-provider records, RLS changes, existing-row updates/deletes or live deployment.
-- Existing duplicate approved-source tasks make this transaction fail; never auto-delete them.
begin;

create unique index cc_one_fictional_task_per_approved_source
on public.cc_records (owner_id, (payload->>'source'))
where item_type='task' and payload->'fictional'='true'::jsonb
  and payload->>'source' ~ '^M1A_APPROVED_';

create function public.cc_approve_fictional_suggestion(
 p_source_id uuid, p_source_version integer, p_title text, p_day date, p_section text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 actor uuid := auth.uid();
 source_row public.cc_records%rowtype;
 task_row public.cc_records%rowtype;
 decision_row public.cc_records%rowtype;
 suggestion_key text;
 suggestion_source text;
 latest_status text;
 prior_approval uuid;
begin
 if actor is null then raise exception 'Sign in before approving a suggestion'; end if;
 if p_source_id is null or p_source_version is null or p_source_version<1
    or p_title is null or char_length(btrim(p_title)) not between 1 and 140
    or p_day is null or p_day<date '2000-01-01' or p_day>date '2100-12-31'
    or p_section is null or p_section not in ('Home','Personal Life','Work','School') then
  raise exception 'Valid source revision and reviewed task fields required';
 end if;
 -- All approvals for this source serialize here. RLS still applies as the caller.
 select * into source_row from public.cc_records
 where id=p_source_id and owner_id=actor and visibility='private'
   and household_id is null and deleted_at is null
 for update;
 if not found or source_row.version<>p_source_version
    or source_row.payload->'fictional' is distinct from 'true'::jsonb then
  raise exception 'Source unavailable or changed; reopen the review';
 end if;
 if source_row.item_type='email_fixture' and source_row.section='Personal Life'
    and source_row.origin='M1C_EMAIL_QA'
    and source_row.payload->>'source'='M1C_EMAIL_QA'
    and source_row.payload->>'template_id' in ('appointment','study') then
  suggestion_key:='email-fixture-'||p_source_id::text; suggestion_source:='email';
 elsif source_row.item_type='school_fixture' and source_row.section='School'
    and source_row.origin='M1D_LIFE_QA' and source_row.payload->>'source'='M1D_LIFE_QA'
    and source_row.payload->>'template_id'='course-assessment' then
  suggestion_key:='life-fixture-'||p_source_id::text; suggestion_source:='school';
 elsif source_row.item_type='household_fixture' and source_row.section='Home'
    and source_row.origin='M1D_LIFE_QA' and source_row.payload->>'source'='M1D_LIFE_QA'
    and source_row.payload->>'template_id'='maintenance' then
  suggestion_key:='life-fixture-'||p_source_id::text; suggestion_source:='household';
 else raise exception 'Only supported fictional sources can be approved';
 end if;
 select * into task_row from public.cc_records
 where owner_id=actor and visibility='private' and household_id is null
  and item_type='task' and payload->'fictional'='true'::jsonb
  and payload->>'source'='M1A_APPROVED_'||suggestion_key limit 1;
 select (payload->>'task_id')::uuid into prior_approval from public.cc_records
 where owner_id=actor and visibility='private' and household_id is null and deleted_at is null
  and item_type='suggestion_decision' and payload->'fictional'='true'::jsonb
  and payload->>'suggestion_id'=suggestion_key and payload->>'source'=suggestion_source
  and payload->>'status'='approved'
 order by created_at desc,id desc limit 1;
 if task_row.id is not null or prior_approval is not null then
  if task_row.id is not null and task_row.deleted_at is null and prior_approval=task_row.id then
   return jsonb_build_object('task_id',task_row.id,'already_saved',true);
  end if;
  raise exception 'Existing approval requires review; nothing overwritten';
 end if;
 select payload->>'status' into latest_status from public.cc_records
 where owner_id=actor and visibility='private' and household_id is null and deleted_at is null
  and item_type='suggestion_decision' and payload->'fictional'='true'::jsonb
  and payload->>'suggestion_id'=suggestion_key and payload->>'source'=suggestion_source
 order by created_at desc,id desc limit 1;
 if latest_status='dismissed' then raise exception 'Suggestion is dismissed; restore it before reviewing'; end if;
 insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload)
 values(actor,null,'private',p_section,'task','manual-test',jsonb_build_object(
  'title',btrim(p_title),'day',p_day::text,'done',false,'fictional',true,'source','M1A_APPROVED_'||suggestion_key))
 returning * into task_row;
 insert into public.cc_records(owner_id,household_id,visibility,section,item_type,origin,payload)
 values(actor,null,'private','Personal Life','suggestion_decision','M1E_APPROVAL_QA',jsonb_build_object(
  'suggestion_id',suggestion_key,'source',suggestion_source,'status','approved','fictional',true,
  'task_id',task_row.id,'task_title',btrim(p_title))) returning * into decision_row;
 return jsonb_build_object('task_id',task_row.id,'decision_id',decision_row.id,'already_saved',false);
end;
$$;
revoke all on function public.cc_approve_fictional_suggestion(uuid,integer,text,date,text) from public,anon;
grant execute on function public.cc_approve_fictional_suggestion(uuid,integer,text,date,text) to authenticated;
commit;
