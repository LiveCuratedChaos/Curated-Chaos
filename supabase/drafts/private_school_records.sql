-- PREPARED ONLY. Additive private School creation/association guards; no record rewrite.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$begin if current_setting('transaction_isolation')<>'read committed' then raise exception 'School schema installation requires read committed';end if;end$$;
lock table public.cc_records in share row exclusive mode nowait;
create function cc_private.school_text(v jsonb,n integer,required boolean default false) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and char_length(v#>>'{}')+(select count(*) from regexp_split_to_table(v#>>'{}','') ch where ascii(ch)>65535)<=n and (not required or length(btrim(v#>>'{}'))>0),false)$$;
create function cc_private.school_day(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare s text;d date;begin if jsonb_typeof(v)<>'string' or v is null then return false;end if;s:=v#>>'{}';if s='' then return true;end if;if s!~'^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$' then return false;end if;begin d:=s::date;exception when others then return false;end;return to_char(d,'YYYY-MM-DD')=s;end$$;
create function cc_private.school_number(v jsonb,maximum numeric,whole boolean default false) returns boolean language sql immutable set search_path='' as $$select case when jsonb_typeof(v)='number' then (v#>>'{}')::numeric between 0 and maximum and (not whole or trunc((v#>>'{}')::numeric)=(v#>>'{}')::numeric) else false end$$;
create function cc_private.school_uuid(v text) returns boolean language sql immutable set search_path='' as $$select coalesce(v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)$$;
create function cc_private.school_payload(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb;t jsonb;s jsonb;ids text[]:='{}';x text;adopted boolean;
begin
 if jsonb_typeof(p) is distinct from 'object' or p->'fictional' is distinct from 'true'::jsonb or p->>'source' is distinct from 'M2E_SCHOOL_QA' or (p?'schemaVersion' and p->'schemaVersion' is distinct from '1'::jsonb) or not cc_private.school_text(p->'title',140,true) or not cc_private.school_day(p->'targetDate') then return false;end if;
 if p->>'kind'='degree' then return not(p?'academicIdentityVersion') and coalesce(p->>'progressMetric' in ('classes','credits','terms'),false) and cc_private.school_number(p->'totalCredits',1000) and cc_private.school_number(p->'totalTerms',100);end if;
 if p->>'kind' is distinct from 'course' or not cc_private.school_text(p->'degreeId',36) or (p->>'degreeId'<>'' and not cc_private.school_uuid(p->>'degreeId')) or not cc_private.school_text(p->'program',100) or not cc_private.school_text(p->'code',30) or not cc_private.school_text(p->'term',40) or (p->>'status' in ('Not Started','In Progress','Submitted','Completed')) is not true or not cc_private.school_number(p->'credits',30) or not cc_private.school_text(p->'notes',1200) then return false;end if;
 foreach x in array array['officialOrder','studyOrder'] loop if p->x is distinct from 'null'::jsonb and (not cc_private.school_number(p->x,999,true) or (p->>x)::numeric<1) then return false;end if;end loop;
 if jsonb_typeof(p->'assessments') is distinct from 'array' or jsonb_array_length(p->'assessments')>25 or jsonb_typeof(p->'studySessions') is distinct from 'array' or jsonb_array_length(p->'studySessions')>50 then return false;end if;
 adopted:=p?'academicIdentityVersion';if adopted and p->'academicIdentityVersion' is distinct from '1'::jsonb then return false;end if;
 for a in select value from jsonb_array_elements(p->'assessments') loop
 if jsonb_typeof(a) is distinct from 'object' or not cc_private.school_text(a->'title',120,true) or (a->>'type' in ('Objective Assessment','Performance Assessment','Other')) is not true or (a->>'status' in ('Not Started','In Progress','Submitted','Completed')) is not true or jsonb_typeof(a->'tasks') is distinct from 'array' or jsonb_array_length(a->'tasks')>20 then return false;end if;
 if adopted then x:=lower(a->>'academicId');if not cc_private.school_uuid(x) or x=any(ids) then return false;end if;ids:=array_append(ids,x);end if;
 for t in select value from jsonb_array_elements(a->'tasks') loop
 if jsonb_typeof(t) is distinct from 'object' or not cc_private.school_text(t->'title',160,true) or jsonb_typeof(t->'done') is distinct from 'boolean' then return false;end if;
 if adopted then x:=lower(t->>'academicId');if not cc_private.school_uuid(x) or x=any(ids) then return false;end if;ids:=array_append(ids,x);end if;
 end loop;end loop;
 for s in select value from jsonb_array_elements(p->'studySessions') loop
 if jsonb_typeof(s) is distinct from 'object' or not cc_private.school_text(s->'title',100,true) or not cc_private.school_day(s->'day') or s->>'day'='' or not cc_private.school_text(s->'time',5) or (s->>'time'<>'' and s->>'time'!~'^([01][0-9]|2[0-3]):[0-5][0-9]$') then return false;end if;
 if adopted then x:=lower(s->>'academicId');if not cc_private.school_uuid(x) or x=any(ids) then return false;end if;ids:=array_append(ids,x);end if;end loop;
 return true;
end$$;
create function cc_private.school_record(r public.cc_records) returns boolean language sql immutable set search_path='' as $$select coalesce(r.visibility='private' and r.household_id is null and r.section='School' and r.item_type='school_fixture' and r.origin='M2E_SCHOOL_QA' and r.deleted_at is null and cc_private.school_payload(r.payload),false)$$;
create function cc_private.school_lock(p_owner uuid) returns void language plpgsql volatile set search_path='' as $$begin if current_setting('transaction_isolation')<>'read committed' then raise exception 'School association changes require read committed';end if;if p_owner is not null then perform pg_advisory_xact_lock(hashtextextended('cc-private-school:'||p_owner::text,0));end if;end$$;
create function cc_private.school_statement_lock() returns trigger language plpgsql set search_path='' as $$begin if auth.uid() is not null then perform pg_advisory_xact_lock(hashtextextended('cc-private-school:'||auth.uid()::text,0));end if;return null;end$$;
create trigger cc_school_statement_lock before insert or update or delete on public.cc_records for each statement execute function cc_private.school_statement_lock();
create function cc_private.school_guard() returns trigger language plpgsql set search_path='' as $$
declare d public.cc_records%rowtype;candidate_record public.cc_records%rowtype;validate_link boolean:=false;protected boolean:=false;restoring_deleted boolean:=false;
begin
 if tg_op='INSERT' and new.item_type='school_fixture' and new.deleted_at is not null then
 restoring_deleted:=coalesce(auth.uid()=new.owner_id and cc_private.development_session_active() and current_setting('role',true)='authenticated' and new.deleted_at<=statement_timestamp() and new.deleted_at>=statement_timestamp()-interval '2160 hours' and exists(select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid() and locktype='relation' and relation='public.cc_records'::regclass and granted and mode='ShareRowExclusiveLock'),false);
 if not restoring_deleted then raise exception 'Protected eligible School tombstone recovery transaction required';end if;
 end if;
 if tg_op<>'INSERT' then
 protected:=old.visibility='private' and old.household_id is null and old.section='School' and old.item_type='school_fixture' and old.origin='M2E_SCHOOL_QA' and old.deleted_at is null and old.payload->>'kind'='degree';
 if protected then
 perform cc_private.school_lock(old.owner_id);
 if tg_op='DELETE' then protected:=true;else protected:=not cc_private.school_record(new) or new.payload->>'kind' is distinct from 'degree';end if;
 if protected and exists(select 1 from public.cc_records c where c.owner_id=old.owner_id and c.visibility='private' and c.household_id is null and c.section='School' and c.item_type='school_fixture' and c.origin='M2E_SCHOOL_QA' and c.deleted_at is null and c.payload->>'kind'='course' and lower(c.payload->>'degreeId')=lower(old.id::text)) then raise exception 'Unlink active courses before changing or deleting their program';end if;
 end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 if new.item_type='school_fixture' and (tg_op='INSERT' or (old.deleted_at is not null and new.deleted_at is null)) then
 perform cc_private.school_lock(new.owner_id);candidate_record:=new;if restoring_deleted then candidate_record.deleted_at:=null;end if;if not cc_private.school_record(candidate_record) then raise exception 'Supported active private School record required';end if;
 end if;
 if new.item_type='school_fixture' and new.payload->>'kind'='course' then
 if tg_op='INSERT' then validate_link:=true;else validate_link:=new.payload->'degreeId' is distinct from old.payload->'degreeId' or (old.deleted_at is not null and new.deleted_at is null) or new.visibility is distinct from old.visibility or new.household_id is distinct from old.household_id or new.owner_id is distinct from old.owner_id or new.section is distinct from old.section or new.origin is distinct from old.origin or new.item_type is distinct from old.item_type or new.payload->>'kind' is distinct from old.payload->>'kind';end if;
 if validate_link then
 if tg_op='UPDATE' and coalesce(old.payload->>'degreeId','')<>'' and coalesce(new.payload->>'degreeId','')<>'' and old.payload->'degreeId' is distinct from new.payload->'degreeId' then raise exception 'Unlink the current program before selecting another';end if;
 perform cc_private.school_lock(new.owner_id);
 candidate_record:=new;if restoring_deleted then candidate_record.deleted_at:=null;end if;if not cc_private.school_record(candidate_record) then raise exception 'Supported active private School course required';end if;
 if new.payload->>'degreeId'<>'' then
 select * into d from public.cc_records where id=(new.payload->>'degreeId')::uuid and owner_id=new.owner_id for share;
 if not found then raise exception 'Current owned private School program required';end if;if restoring_deleted then d.deleted_at:=null;end if;if not cc_private.school_record(d) or d.payload->>'kind' is distinct from 'degree' then raise exception 'Current owned private School program required';end if;
 end if;
 end if;
 end if;return new;
end$$;
create trigger cc_school_guard before insert or update or delete on public.cc_records for each row execute function cc_private.school_guard();
create function public.create_private_school_record(p_record_id uuid,p_kind text,p_payload jsonb,p_degree_id uuid default null,p_degree_version integer default null) returns public.cc_records language plpgsql set search_path='' as $$
declare actor uuid:=auth.uid();d public.cc_records%rowtype;r public.cc_records%rowtype;allowed text[];
begin
 if actor is null or not cc_private.development_session_active() or p_record_id is null or p_kind not in ('degree','course') or p_payload->>'kind' is distinct from p_kind or p_payload->'schemaVersion' is distinct from '1'::jsonb or not cc_private.school_payload(p_payload) then raise exception 'Exact reviewed School creation required';end if;
 perform cc_private.school_lock(actor);
 if p_payload->>'title' is distinct from btrim(p_payload->>'title') or (p_payload->>'title') ~ '[\x01-\x1f\x7f]' then raise exception 'Canonical School title required';end if;
 if p_kind='degree' then allowed:=array['fictional','source','schemaVersion','kind','title','progressMetric','totalCredits','totalTerms','targetDate'];if p_degree_id is not null or p_degree_version is not null then raise exception 'Degree creation cannot select another program';end if;
 else allowed:=array['fictional','source','schemaVersion','kind','title','degreeId','program','code','term','status','credits','officialOrder','studyOrder','targetDate','notes','assessments','studySessions'];if p_payload->>'program' is distinct from '' or p_payload->'assessments' is distinct from '[]'::jsonb or p_payload->'studySessions' is distinct from '[]'::jsonb or p_payload->>'degreeId' is distinct from coalesce(p_degree_id::text,'') then raise exception 'New courses use canonical program identity and empty academic arrays';end if;
 end if;
 if (select count(*) from jsonb_object_keys(p_payload))<>cardinality(allowed) or exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(allowed))) then raise exception 'Exact new School payload keys required';end if;
 if p_degree_id is not null then
 select * into d from public.cc_records where id=p_degree_id and owner_id=actor for share;
 if not found or not cc_private.school_record(d) or d.payload->>'kind' is distinct from 'degree' or p_degree_version is null or d.version<>p_degree_version then raise exception 'School program changed; review again';end if;
 elsif p_degree_version is not null then raise exception 'Unexpected School program version';end if;
 insert into public.cc_records(id,owner_id,visibility,household_id,section,item_type,origin,payload) values(p_record_id,actor,'private',null,'School','school_fixture','M2E_SCHOOL_QA',p_payload) returning * into r;return r;
end$$;
create function public.set_private_school_program(p_course_id uuid,p_expected_version integer,p_expected_degree_id text,p_degree_id uuid default null,p_degree_version integer default null) returns public.cc_records language plpgsql set search_path='' as $$
declare actor uuid:=auth.uid();c public.cc_records%rowtype;d public.cc_records%rowtype;target text:=coalesce(p_degree_id::text,'');
begin
 if actor is null or not cc_private.development_session_active() or p_course_id is null or p_expected_version is null or p_expected_version<1 or p_expected_degree_id is null then raise exception 'Exact reviewed School association required';end if;
 perform cc_private.school_lock(actor);
 select * into c from public.cc_records where id=p_course_id and owner_id=actor for update;
 if not found or not cc_private.school_record(c) or c.payload->>'kind' is distinct from 'course' or c.version<>p_expected_version or c.payload->>'degreeId' is distinct from p_expected_degree_id then raise exception 'School course changed; review again';end if;
 if target=p_expected_degree_id then raise exception 'School program association is unchanged';end if;
 if target<>'' and p_expected_degree_id<>'' then raise exception 'Unlink the current program before selecting another';end if;
 if p_degree_id is not null then
 select * into d from public.cc_records where id=p_degree_id and owner_id=actor for share;
 if not found or not cc_private.school_record(d) or d.payload->>'kind' is distinct from 'degree' or p_degree_version is null or d.version<>p_degree_version then raise exception 'School program changed; review again';end if;
 elsif p_degree_version is not null then raise exception 'Unexpected School program version';end if;
 update public.cc_records set payload=jsonb_set(payload,'{degreeId}',to_jsonb(target)) where id=c.id returning * into c;return c;
end$$;
revoke all on function cc_private.school_text(jsonb,integer,boolean),cc_private.school_day(jsonb),cc_private.school_number(jsonb,numeric,boolean),cc_private.school_uuid(text),cc_private.school_payload(jsonb),cc_private.school_record(public.cc_records),cc_private.school_lock(uuid),cc_private.school_statement_lock(),cc_private.school_guard() from public,anon,authenticated;
-- Invoker RPCs and trigger helpers retain RLS; authenticated needs execution for nested calls.
grant execute on function cc_private.school_text(jsonb,integer,boolean),cc_private.school_day(jsonb),cc_private.school_number(jsonb,numeric,boolean),cc_private.school_uuid(text),cc_private.school_payload(jsonb),cc_private.school_record(public.cc_records),cc_private.school_lock(uuid) to authenticated;
revoke all on function public.create_private_school_record(uuid,text,jsonb,uuid,integer),public.set_private_school_program(uuid,integer,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.create_private_school_record(uuid,text,jsonb,uuid,integer),public.set_private_school_program(uuid,integer,text,uuid,integer) to authenticated;
commit;
