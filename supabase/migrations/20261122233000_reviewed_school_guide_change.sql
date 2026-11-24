begin;
create function public.cc_apply_private_school_guide_change(p_record uuid,p_version integer,p_document_version integer,p_change jsonb)
returns setof public.cc_records language plpgsql security invoker set search_path='' as $$
declare source public.cc_records; original uuid; evidence jsonb; latest jsonb; field_name text; ceiling numeric; quote_pattern text; anchor_pattern text; anchor_value text;
begin
 if auth.uid() is null or not coalesce(cc_private.development_session_active(),false) then raise exception 'Active School owner required'; end if;
 if jsonb_typeof(p_change) is distinct from 'object' or not (p_change ?& array['documentId','kind','field','before','after','page','anchor','quote'])
 or (p_change-array['documentId','kind','field','before','after','page','anchor','quote'])<>'{}'::jsonb or
 jsonb_typeof(p_change->'before') is distinct from 'number' or jsonb_typeof(p_change->'after') is distinct from 'number' or
 jsonb_typeof(p_change->'page') is distinct from 'number' or (p_change->>'page')!~'^[1-9][0-9]?$' or (p_change->>'page')::int>80 or
 jsonb_typeof(p_change->'quote') is distinct from 'string' or length(p_change->>'quote') not between 1 and 180 or
 jsonb_typeof(p_change->'anchor') is distinct from 'string' or length(p_change->>'anchor') not between 1 and 180 then
 raise exception 'Invalid School evidence'; end if;
 original:=(p_change->>'documentId')::uuid;
 perform id from public.cc_private_documents where owner_id=auth.uid() and id=original and version=p_document_version for share;
 if not found then raise exception 'Guide document changed'; end if;
 select * into source from public.cc_records where id=p_record and owner_id=auth.uid() and version=p_version
 and visibility='private' and household_id is null and deleted_at is null and section='School' and item_type='school_fixture'
 and origin='M2E_SCHOOL_QA' and payload->>'source'='M2E_SCHOOL_QA' and payload->'fictional'='true'::jsonb for update;
 if not found then raise exception 'School record changed'; end if;
 select g into latest from jsonb_array_elements(source.payload->'guideDocuments') with ordinality as guides(g,n)
 where g->>'kind'=p_change->>'kind' order by n desc limit 1;
 if latest->>'documentId' is distinct from original::text then raise exception 'Guide version changed'; end if;
 field_name:=p_change->>'field';
 if source.payload->>'kind'='course' and p_change->>'kind' in ('course','syllabus') and field_name='credits' then
  ceiling:=30;quote_pattern:='^(?:course credits|credits|credit hours|competency units)\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)$';
  anchor_pattern:='^course code\s*:\s*(.+)$';anchor_value:=source.payload->>'code';
 elsif source.payload->>'kind'='degree' and p_change->>'kind'='program' and field_name in ('totalCredits','totalTerms') then
  ceiling:=case when field_name='totalTerms' then 100 else 1000 end;
  quote_pattern:=case when field_name='totalTerms' then '^(?:total terms|total program terms)\s*:\s*([0-9]+)$' else '^(?:total credits|total program credits|total competency units)\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)$' end;
  anchor_pattern:='^(?:program|degree program)\s*:\s*(.+)$';anchor_value:=source.payload->>'title';
 else raise exception 'Unsupported plan field'; end if;
 if source.payload->field_name is distinct from p_change->'before' or p_change->'before'=p_change->'after'
 or (p_change->>'after')::numeric not between 0 and ceiling or (p_change->>'quote')!~*quote_pattern
 or ((regexp_match(p_change->>'quote',quote_pattern,'i'))[1])::numeric is distinct from (p_change->>'after')::numeric
 or (p_change->>'anchor')!~*anchor_pattern or lower(regexp_replace(btrim((regexp_match(p_change->>'anchor',anchor_pattern,'i'))[1]),'\s+',' ','g'))
 is distinct from lower(regexp_replace(btrim(anchor_value),'\s+',' ','g')) then raise exception 'Guide proposal changed'; end if;
 evidence:=coalesce(source.payload->'guideChanges','[]');
 if jsonb_typeof(evidence)<>'array' or jsonb_array_length(evidence)>=150 or exists(select 1 from jsonb_array_elements(evidence) g
 where g->>'documentId'=original::text and g->>'kind'=p_change->>'kind' and g->>'field'=field_name) then raise exception 'Guide change already recorded'; end if;
 return query update public.cc_records set payload=jsonb_set(jsonb_set(payload,array[field_name],p_change->'after'),'{guideChanges}',evidence||jsonb_build_array(p_change))
 where id=source.id and owner_id=auth.uid() and version=p_version returning *;
end;
$$;
revoke all on function public.cc_apply_private_school_guide_change(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.cc_apply_private_school_guide_change(uuid,integer,integer,jsonb) to authenticated;
commit;
