begin;
-- Serialize a checked study slot only with writes to the same owner's saved schedule.
create function cc_private.lock_changed_study_schedule() returns trigger
language plpgsql set search_path='' as $$
declare old_owner uuid; new_owner uuid; target uuid;
begin
 if tg_op<>'INSERT' and old.visibility='private' and
  ((old.section='Calendar' and old.item_type='event') or (old.section='School' and old.item_type='school_fixture' and old.payload->>'kind'='course')) then old_owner=old.owner_id;end if;
 if tg_op<>'DELETE' and new.visibility='private' and
  ((new.section='Calendar' and new.item_type='event') or (new.section='School' and new.item_type='school_fixture' and new.payload->>'kind'='course')) then new_owner=new.owner_id;end if;
 for target in select distinct u from unnest(array[old_owner,new_owner]) u where u is not null order by u loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cc-study-schedule:'||target::text,0));
 end loop;
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function cc_private.lock_changed_study_schedule() from public;
create trigger cc_lock_changed_study_schedule before insert or update or delete on public.cc_records
for each row execute function cc_private.lock_changed_study_schedule();
create function public.cc_append_private_study_session(
 p_course uuid, p_version integer, p_schedule jsonb, p_session jsonb
) returns setof public.cc_records
language plpgsql security invoker set search_path = '' as $$
declare actual jsonb;
begin
 if auth.uid() is null or not coalesce(cc_private.development_session_active(),false) then
  raise exception 'Active study planner owner required';
 end if;
 if jsonb_typeof(p_schedule) is distinct from 'array' or jsonb_array_length(p_schedule)>4000 or
    jsonb_typeof(p_session) is distinct from 'object' or
    not (p_session ?& array['title','day','time','endTime']) or (p_session-array['title','day','time','endTime','academicId'])<>'{}'::jsonb or
    jsonb_typeof(p_session->'title') is distinct from 'string' or jsonb_typeof(p_session->'day') is distinct from 'string' or
    jsonb_typeof(p_session->'time') is distinct from 'string' or jsonb_typeof(p_session->'endTime') is distinct from 'string' or
    length(p_session->>'title') not between 1 and 100 or
    (p_session->>'day')!~'^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$' or
    to_char((p_session->>'day')::date,'YYYY-MM-DD')<>p_session->>'day' or
    (p_session->>'time')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or
    (p_session->>'endTime')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or (p_session->>'endTime')<=(p_session->>'time') then
  raise exception 'Invalid study session';
 end if;
 -- A concurrent ordinary event or course write must complete before its revision is compared.
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('cc-study-schedule:'||auth.uid()::text,0)) then raise exception 'Study schedule is changing';end if;
 perform id from public.cc_records where id=p_course and owner_id=auth.uid() for update nowait;
 select coalesce(jsonb_agg(jsonb_build_array(id,version) order by id),'[]'::jsonb) into actual
 from public.cc_records where owner_id=auth.uid() and visibility='private' and household_id is null and deleted_at is null
 and ((section='Calendar' and item_type='event') or (section='School' and item_type='school_fixture' and origin='M2E_SCHOOL_QA' and payload->>'kind'='course'));
 if actual is distinct from p_schedule then raise exception 'Study schedule changed';end if;
 -- Enforce the overlap rule in the transaction even for a fresh, directly supplied inventory.
 if exists (
  select 1 from public.cc_records r where r.owner_id=auth.uid() and r.household_id is null
   and r.visibility='private' and r.deleted_at is null and r.section='Calendar' and r.item_type='event'
   and (r.payload->>'day')<=p_session->>'day'
   and coalesce(nullif(r.payload->>'end_day',''),r.payload->>'day')>=p_session->>'day'
   and (r.payload->>'all_day'='true' or
    ((r.payload->>'day'<p_session->>'day' or r.payload->>'time'<p_session->>'endTime') and
     (coalesce(nullif(r.payload->>'end_day',''),r.payload->>'day')>p_session->>'day' or
      coalesce(nullif(r.payload->>'end_time',''),'24:00')>p_session->>'time')))
 ) or exists (
  select 1 from public.cc_records r cross join lateral jsonb_array_elements(r.payload->'studySessions') s
  where r.owner_id=auth.uid() and r.household_id is null and r.visibility='private' and r.deleted_at is null
   and r.section='School' and r.item_type='school_fixture' and r.origin='M2E_SCHOOL_QA' and r.payload->>'kind'='course'
   and s->>'day'=p_session->>'day' and coalesce(nullif(s->>'time',''),'00:00')<p_session->>'endTime'
   and coalesce(nullif(s->>'endTime',''),'24:00')>p_session->>'time'
 ) then raise exception 'Study session overlaps a saved commitment';end if;
 return query update public.cc_records set payload=jsonb_set(payload,'{studySessions}',(payload->'studySessions')||jsonb_build_array(p_session))
 where id=p_course and version=p_version and owner_id=auth.uid() and visibility='private' and household_id is null and deleted_at is null
 and section='School' and item_type='school_fixture' and origin='M2E_SCHOOL_QA' and payload->>'kind'='course'
 and payload->>'status'<>'Completed' and jsonb_typeof(payload->'studySessions')='array' and jsonb_array_length(payload->'studySessions')<50
 and ((payload->>'academicIdentityVersion'='1' and p_session?'academicId' and (p_session->>'academicId')::uuid is not null)
    or (not (payload?'academicIdentityVersion') and not (p_session?'academicId')))
 returning *;
end;
$$;
revoke all on function public.cc_append_private_study_session(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.cc_append_private_study_session(uuid,integer,jsonb,jsonb) to authenticated;
commit;
