-- OFFLINE PREPARATION ONLY. No membership table, writer, trigger, or runtime activation.
-- Canonical key functions are prerequisites for later reviewed storage guards/indexes.
begin;
create function cc_private.common_task_reference_key(p_reference jsonb,p_task boolean)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare k text;keys text[];field text;
begin
 if p_task is null or jsonb_typeof(p_reference) is distinct from 'object'
 or jsonb_typeof(p_reference->'kind') is distinct from 'string' then return null;end if;
 k:=p_reference->>'kind';
 if (p_task and k not in ('task','school-step'))
 or (not p_task and k not in ('project','school-degree','school-course','school-assessment')) then return null;end if;
 keys:=array['kind','recordId'];
 if k in ('school-assessment','school-step') then keys:=keys||'academicId'::text;end if;
 if k='school-step' then keys:=keys||'assessmentId'::text;end if;
 if (select count(*) from jsonb_object_keys(p_reference))<>cardinality(keys)
 or not(p_reference ?& keys) then return null;end if;
 foreach field in array keys loop
 if field='kind' then continue;end if;
 if jsonb_typeof(p_reference->field) is distinct from 'string'
 or p_reference->>field !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null;end if;
 end loop;
 return k||':'||lower(p_reference->>'recordId')
 ||case when k='school-step' then ':'||lower(p_reference->>'assessmentId') else '' end
 ||case when k in ('school-step','school-assessment') then ':'||lower(p_reference->>'academicId') else '' end;
end$$;
create function cc_private.common_task_membership_key(p_task jsonb,p_project jsonb)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare t text;p text;
begin
 t:=cc_private.common_task_reference_key(p_task,true);
 p:=cc_private.common_task_reference_key(p_project,false);
 if t is null or p is null or (p_task->>'kind'='task' and p_project->>'kind'='project') then return null;end if;
 return t||'|'||p;
end$$;
revoke all on function cc_private.common_task_reference_key(jsonb,boolean),cc_private.common_task_membership_key(jsonb,jsonb) from public,anon;
grant execute on function cc_private.common_task_reference_key(jsonb,boolean),cc_private.common_task_membership_key(jsonb,jsonb) to authenticated;
commit;
