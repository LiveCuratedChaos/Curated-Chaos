-- PREPARED ONLY. Additive in-course academic recovery; no data rewrites or new tables.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$begin if current_setting('transaction_isolation')<>'read committed' then raise exception 'Academic recovery installation requires read committed';end if;end$$;
lock table public.cc_records in share row exclusive mode nowait;
create function cc_private.school_recovery_active_ids(p jsonb) returns text[] language plpgsql immutable set search_path='' as $$
declare result text[]:='{}';a jsonb;t jsonb;
begin
 for a in select value from jsonb_array_elements(p->'assessments') loop result:=array_append(result,a->>'academicId');for t in select value from jsonb_array_elements(a->'tasks') loop result:=array_append(result,t->>'academicId');end loop;end loop;
 for a in select value from jsonb_array_elements(p->'studySessions') loop result:=array_append(result,a->>'academicId');end loop;return result;
end$$;
create function cc_private.school_recovery_time(v jsonb) returns timestamptz language plpgsql immutable set search_path='' as $$
declare s text;r timestamptz;
begin
 if jsonb_typeof(v) is distinct from 'string' then return null;end if;s:=v#>>'{}';
 if s!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$' then return null;end if;
 begin r:=s::timestamptz;exception when others then return null;end;
 if to_char(r at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>s then return null;end if;return r;
end$$;
create function cc_private.school_recovery_payload(p jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare ids text[];parents text[]:='{}';refs text[]:='{}';e jsonb;a jsonb;t jsonb;x text;n integer;
begin
 if not cc_private.school_payload(p) then return false;end if;
 if not(p?'academicRecoveryVersion') and not(p?'removedAcademicRecords') then return true;end if;
 if p->>'kind' is distinct from 'course' or p->'academicIdentityVersion' is distinct from '1'::jsonb or p->'academicRecoveryVersion' is distinct from '1'::jsonb or jsonb_typeof(p->'removedAcademicRecords') is distinct from 'array' then return false;end if;
 if jsonb_array_length(p->'removedAcademicRecords')>100 or octet_length(convert_to(p::text,'UTF8'))>524288 then return false;end if;
 ids:=cc_private.school_recovery_active_ids(p);
 for a in select value from jsonb_array_elements(p->'assessments') loop parents:=array_append(parents,a->>'academicId');end loop;
 for e in select value from jsonb_array_elements(p->'removedAcademicRecords') loop
  if jsonb_typeof(e) is distinct from 'object' or (select count(*) from jsonb_object_keys(e))<>6 or not(e?&array['recoveryId','kind','parentAcademicId','position','removedAt','record']) or not cc_private.school_uuid(e->>'recoveryId') or cc_private.school_recovery_time(e->'removedAt') is null or not cc_private.school_number(e->'position',case when e->>'kind'='assessment' then 25 else 20 end,true) or (e->>'position')::numeric<1 then return false;end if;
  ids:=array_append(ids,e->>'recoveryId');a:=e->'record';
  if jsonb_typeof(a) is distinct from 'object' or not cc_private.school_uuid(a->>'academicId') then return false;end if;
  ids:=array_append(ids,a->>'academicId');
  if e->>'kind'='assessment' then
   if e->'parentAcademicId' is distinct from 'null'::jsonb or not cc_private.school_text(a->'title',120,true) or (a->>'type' in ('Objective Assessment','Performance Assessment','Other')) is not true or (a->>'status' in ('Not Started','In Progress','Submitted','Completed')) is not true or jsonb_typeof(a->'tasks') is distinct from 'array' or jsonb_array_length(a->'tasks')>20 then return false;end if;
   parents:=array_append(parents,a->>'academicId');
   for t in select value from jsonb_array_elements(a->'tasks') loop
    if jsonb_typeof(t) is distinct from 'object' or not cc_private.school_uuid(t->>'academicId') or not cc_private.school_text(t->'title',160,true) or jsonb_typeof(t->'done') is distinct from 'boolean' then return false;end if;ids:=array_append(ids,t->>'academicId');
   end loop;
  elsif e->>'kind'='step' then
   if not cc_private.school_uuid(e->>'parentAcademicId') or not cc_private.school_text(a->'title',160,true) or jsonb_typeof(a->'done') is distinct from 'boolean' then return false;end if;refs:=array_append(refs,e->>'parentAcademicId');
  else return false;end if;
 end loop;
 if cardinality(ids)>1000 or exists(select 1 from unnest(ids) v where not cc_private.school_uuid(v)) or (select count(distinct lower(v)) from unnest(ids) v)<>cardinality(ids) or exists(select 1 from unnest(refs) v where not(v=any(parents))) then return false;end if;
 return true;
exception when others then return false;
end$$;
create function cc_private.school_recovery_guard() returns trigger language plpgsql set search_path='' as $$
declare old_course boolean:=false;new_course boolean;old_entries jsonb;new_entries jsonb;e jsonb;expected jsonb;items jsonb;a jsonb;t jsonb;actual jsonb;found_node boolean:=false;idx integer;parent_idx integer;entry_idx integer;pos integer;removed_time timestamptz;v text;old_a jsonb;new_a jsonb;old_t jsonb;
begin
 new_course:=coalesce(new.visibility='private' and new.household_id is null and new.section='School' and new.item_type='school_fixture' and new.origin='M2E_SCHOOL_QA' and new.payload->>'kind'='course',false);
 if tg_op='UPDATE' then old_course:=coalesce(old.visibility='private' and old.household_id is null and old.section='School' and old.item_type='school_fixture' and old.origin='M2E_SCHOOL_QA' and old.payload->>'kind'='course',false);end if;
 if old_course and (old.payload?'academicIdentityVersion' or old.payload?'academicRecoveryVersion' or old.payload?'removedAcademicRecords') and not new_course then raise exception 'Canonical academic recovery scope must be preserved';end if;
 if new.visibility='private' and new.household_id is null and new.section='School' and new.item_type='school_fixture' and new.origin='M2E_SCHOOL_QA' and (new.payload?'academicRecoveryVersion' or new.payload?'removedAcademicRecords') and not cc_private.school_recovery_payload(new.payload) then raise exception 'Supported academic recovery reservation required';end if;
 if not new_course then return new;end if;
 if not cc_private.school_recovery_payload(new.payload) then raise exception 'Supported academic recovery payload required';end if;
 if tg_op='INSERT' or not old_course then return new;end if;
 if old.payload->'academicIdentityVersion'='1'::jsonb and new.payload->'academicIdentityVersion' is distinct from '1'::jsonb then raise exception 'Stable academic identities cannot be removed';end if;
 if (old.payload?'academicRecoveryVersion' and new.payload->'academicRecoveryVersion' is distinct from old.payload->'academicRecoveryVersion') or (old.payload?'removedAcademicRecords' and not(new.payload?'removedAcademicRecords')) then raise exception 'Academic recovery history cannot be removed';end if;
 old_entries:=coalesce(old.payload->'removedAcademicRecords','[]'::jsonb);new_entries:=coalesce(new.payload->'removedAcademicRecords','[]'::jsonb);
 if old_entries=new_entries then
  if (old.payload?'academicRecoveryVersion') is distinct from (new.payload?'academicRecoveryVersion') then raise exception 'Academic recovery marker requires a reviewed removal';end if;
  if old.payload->'academicIdentityVersion'='1'::jsonb then
   foreach v in array cc_private.school_recovery_active_ids(old.payload) loop if not(v=any(cc_private.school_recovery_active_ids(new.payload))) then raise exception 'Academic identities require recoverable removal';end if;end loop;
   for old_a in select value from jsonb_array_elements(old.payload->'assessments') loop
    select value into new_a from jsonb_array_elements(new.payload->'assessments') where value->>'academicId'=old_a->>'academicId';
    if not found then raise exception 'Academic assessment identities and kinds must be preserved';end if;
    for old_t in select value from jsonb_array_elements(old_a->'tasks') loop if not exists(select 1 from jsonb_array_elements(new_a->'tasks') x where x->>'academicId'=old_t->>'academicId') then raise exception 'Academic step identities must retain their original parent';end if;end loop;
   end loop;
   for old_a in select value from jsonb_array_elements(old.payload->'studySessions') loop if not exists(select 1 from jsonb_array_elements(new.payload->'studySessions') x where x->>'academicId'=old_a->>'academicId') then raise exception 'Academic study identities and kinds must be preserved';end if;end loop;

  end if;return new;
 end if;
 if jsonb_array_length(new_entries)=jsonb_array_length(old_entries)+1 and (new_entries-(jsonb_array_length(new_entries)-1))=old_entries then
  e:=new_entries->(jsonb_array_length(old_entries));removed_time:=cc_private.school_recovery_time(e->'removedAt');if removed_time is null or removed_time>date_trunc('milliseconds',statement_timestamp()) or removed_time<date_trunc('milliseconds',statement_timestamp())-interval '5 minutes' then raise exception 'Fresh academic removal time required';end if;
  expected:=old.payload;pos:=(e->>'position')::integer;idx:=0;
  if e->>'kind'='assessment' then
   actual:=old.payload->'assessments'->(pos-1);if actual is null or actual is distinct from e->'record' or e->'parentAcademicId' is distinct from 'null'::jsonb then raise exception 'Exact saved assessment removal required';end if;
   expected:=jsonb_set(expected,'{assessments}',(old.payload->'assessments')-(pos-1));
  else
   for a in select value from jsonb_array_elements(old.payload->'assessments') loop
    if a->>'academicId'=e->>'parentAcademicId' then
     actual:=a->'tasks'->(pos-1);if actual is null or actual is distinct from e->'record' then raise exception 'Exact saved step removal required';end if;
     expected:=jsonb_set(expected,array['assessments',idx::text,'tasks'],(a->'tasks')-(pos-1));found_node:=true;exit;
    end if;idx:=idx+1;
   end loop;if not found_node then raise exception 'Original active assessment required for removal';end if;
  end if;
  expected:=jsonb_set(jsonb_set(expected,'{academicRecoveryVersion}','1'::jsonb),'{removedAcademicRecords}',new_entries);
 elsif jsonb_array_length(new_entries)=jsonb_array_length(old_entries)-1 then
  entry_idx:=-1;idx:=0;for e in select value from jsonb_array_elements(old_entries) loop if (old_entries-idx)=new_entries then entry_idx:=idx;exit;end if;idx:=idx+1;end loop;
  if entry_idx<0 then raise exception 'Exactly one retained recovery entry may be restored';end if;e:=old_entries->entry_idx;removed_time:=cc_private.school_recovery_time(e->'removedAt');
  if removed_time is null or removed_time>date_trunc('milliseconds',statement_timestamp()) or removed_time<date_trunc('milliseconds',statement_timestamp())-interval '2160 hours' then raise exception 'Academic recovery entry is outside its restore window';end if;
  expected:=old.payload;pos:=(e->>'position')::integer;
  if e->>'kind'='assessment' then
   items:=old.payload->'assessments';if jsonb_array_length(items)>=25 then raise exception 'Active assessment capacity reached';end if;pos:=least(pos,jsonb_array_length(items)+1);
   expected:=jsonb_set(expected,'{assessments}',jsonb_insert(items,array[(pos-1)::text],e->'record',false));
  else
   idx:=0;for a in select value from jsonb_array_elements(old.payload->'assessments') loop
    if a->>'academicId'=e->>'parentAcademicId' then
     items:=a->'tasks';if jsonb_array_length(items)>=20 then raise exception 'Active step capacity reached';end if;pos:=least(pos,jsonb_array_length(items)+1);
     expected:=jsonb_set(expected,array['assessments',idx::text,'tasks'],jsonb_insert(items,array[(pos-1)::text],e->'record',false));found_node:=true;exit;
    end if;idx:=idx+1;
   end loop;if not found_node then raise exception 'Original active assessment required for restoration';end if;
  end if;expected:=jsonb_set(expected,'{removedAcademicRecords}',new_entries);
 else raise exception 'Exactly one academic removal or restoration required';end if;
 if expected is distinct from new.payload then raise exception 'Academic recovery must preserve every unrelated source value';end if;return new;
end$$;
create trigger cc_school_academic_recovery_guard before insert or update on public.cc_records for each row execute function cc_private.school_recovery_guard();
revoke all on function cc_private.school_recovery_active_ids(jsonb),cc_private.school_recovery_time(jsonb),cc_private.school_recovery_payload(jsonb),cc_private.school_recovery_guard() from public,anon,authenticated;
grant execute on function cc_private.school_recovery_active_ids(jsonb),cc_private.school_recovery_time(jsonb),cc_private.school_recovery_payload(jsonb) to authenticated;
commit;
