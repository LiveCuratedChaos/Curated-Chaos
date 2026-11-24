-- OFFLINE PREPARATION ONLY. Canonical endpoint predicates, no membership writer or activation.
-- Requires private_school_records, private_school_academic_recovery and common reference contracts.
begin;
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
commit;
