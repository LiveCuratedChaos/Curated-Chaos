-- PREPARED ONLY. No hosted execution or UI activation is part of this migration.
-- Private fictional app tasks only; no household writes or automatic recurrence.
begin;
create function cc_private.recurring_chore_day(anchor date, frequency text, every_n integer, ordinal integer)
returns date language plpgsql immutable set search_path='' as $$
declare result date; total_months integer; y integer; m integer; last_day integer;
begin
 if anchor is null or anchor<date '2000-01-01' or anchor>date '2100-12-31'
 or frequency is null or frequency not in ('daily','weekly','monthly','yearly')
 or every_n is null or every_n not between 1 and 365 or ordinal is null or ordinal not between 0 and 37000 then
 raise exception 'Invalid recurring schedule';end if;
 if frequency in ('daily','weekly') then
  result:=anchor+ordinal*every_n*(case when frequency='weekly' then 7 else 1 end);
 else
  total_months:=extract(year from anchor)::integer*12+extract(month from anchor)::integer-1+ordinal*every_n*(case when frequency='yearly' then 12 else 1 end);
  y:=total_months/12;m:=total_months%12+1;if y>2100 then return null;end if;
  last_day:=extract(day from (make_date(y,m,1)+interval '1 month - 1 day'))::integer;
  result:=make_date(y,m,least(extract(day from anchor)::integer,last_day));
 end if;
 if result>date '2100-12-31' then return null;end if;return result;
end $$;
create function cc_private.recurring_chore_plan(schedule jsonb, due_day date, completed_on date)
returns jsonb language plpgsql immutable set search_path='' as $$
declare anchor date;frequency text;every_n integer;low integer;high integer;mid integer;candidate date;cutoff date;current_ordinal integer;next_ordinal integer;phase integer;
begin
 if schedule is null or jsonb_typeof(schedule)<>'object' or (select count(*) from jsonb_object_keys(schedule))<>3
 or not(schedule ?& array['anchorDay','frequency','interval'])
 or jsonb_typeof(schedule->'anchorDay')<>'string' or jsonb_typeof(schedule->'frequency')<>'string'
 or jsonb_typeof(schedule->'interval')<>'number' or (schedule->>'interval') !~ '^[0-9]{1,3}$'
 or (schedule->>'anchorDay') !~ '^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$'
 or due_day is null or completed_on is null or due_day not between date '2000-01-01' and date '2100-12-31'
 or completed_on not between date '2000-01-01' and date '2100-12-31' then raise exception 'Exact dated recurring schedule required';end if;
 anchor:=(schedule->>'anchorDay')::date;frequency:=schedule->>'frequency';every_n:=(schedule->>'interval')::integer;
 -- Validate even when the first binary-search candidate is beyond the supported range.
 perform cc_private.recurring_chore_day(anchor,frequency,every_n,0);
 for phase in 1..2 loop
  cutoff:=case when phase=1 then due_day else greatest(due_day,completed_on) end;low:=0;high:=37000;
  while low<high loop
   mid:=(low+high)/2;candidate:=cc_private.recurring_chore_day(anchor,frequency,every_n,mid);
   if candidate is not null and candidate<=cutoff then low:=mid+1;else high:=mid;end if;
  end loop;
  if phase=1 then current_ordinal:=low-1;else next_ordinal:=low;end if;
 end loop;
 if current_ordinal<0 or cc_private.recurring_chore_day(anchor,frequency,every_n,current_ordinal) is distinct from due_day then raise exception 'Current due date is off the original schedule';end if;
 candidate:=cc_private.recurring_chore_day(anchor,frequency,every_n,next_ordinal);
 if candidate is null then raise exception 'Next occurrence is beyond 2100';end if;
 return jsonb_build_object('day',candidate::text,'ordinal',next_ordinal,'currentOrdinal',current_ordinal,'skippedOccurrences',next_ordinal-current_ordinal-1);
end $$;
create unique index cc_unique_private_chore_occurrence
 on public.cc_records(owner_id,(payload->'recurrence'->>'seriesId'),(payload->'recurrence'->>'ordinal'))
 where item_type='task' and visibility='private' and household_id is null
 and payload->'fictional'='true'::jsonb and payload->'recurrence' ? 'seriesId' and payload->'recurrence' ? 'ordinal';
create function public.cc_complete_recurring_chore(p_record_id uuid,p_version integer,p_schedule jsonb,p_next_day date,p_review_day date,p_operation_id uuid,p_successor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();source_row public.cc_records%rowtype;successor public.cc_records%rowtype;plan jsonb;series_id text;marker jsonb;recurrence jsonb;next_payload jsonb;steps jsonb;
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
  return jsonb_build_object('completedRecord',to_jsonb(source_row),'nextRecord',to_jsonb(successor),'alreadySaved',true);
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
 return jsonb_build_object('completedRecord',to_jsonb(source_row),'nextRecord',to_jsonb(successor),'alreadySaved',false);
end $$;
revoke all on function cc_private.recurring_chore_day(date,text,integer,integer),cc_private.recurring_chore_plan(jsonb,date,date) from public,anon,authenticated;
grant execute on function cc_private.recurring_chore_day(date,text,integer,integer),cc_private.recurring_chore_plan(jsonb,date,date) to authenticated;
revoke all on function public.cc_complete_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid) from public,anon;
grant execute on function public.cc_complete_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid) to authenticated;
commit;
