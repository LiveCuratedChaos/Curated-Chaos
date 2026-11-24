begin;
create function public.cc_append_private_school_guide(p_record uuid,p_version integer,p_document_version integer,p_guide jsonb)
returns setof public.cc_records language plpgsql security invoker set search_path='' as $$
declare source public.cc_records; guides jsonb; file_id uuid;
begin
 if auth.uid() is null or not coalesce(cc_private.development_session_active(),false) then raise exception 'Active School owner required'; end if;
 if jsonb_typeof(p_guide) is distinct from 'object' or not (p_guide ?& array['kind','documentId','addedAt'])
  or (p_guide-array['kind','documentId','addedAt'])<>'{}'::jsonb
  or jsonb_typeof(p_guide->'addedAt') is distinct from 'string' or jsonb_typeof(p_guide->'documentId') is distinct from 'string'
  or (p_guide->>'addedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
  or to_char((p_guide->>'addedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from p_guide->>'addedAt'
  or (p_guide->>'documentId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
  raise exception 'Invalid School guide version'; end if;
 file_id:=(p_guide->>'documentId')::uuid;
 perform id from public.cc_private_documents where owner_id=auth.uid() and id=file_id and version=p_document_version for share;
 if not found then raise exception 'Guide document changed'; end if;
 select * into source from public.cc_records where id=p_record and owner_id=auth.uid() and version=p_version
  and visibility='private' and household_id is null and deleted_at is null and section='School'
  and item_type='school_fixture' and origin='M2E_SCHOOL_QA' and payload->>'source'='M2E_SCHOOL_QA'
  and payload->'fictional'='true'::jsonb for update;
 if not found or not coalesce(((source.payload->>'kind'='degree' and p_guide->>'kind'='program')
   or (source.payload->>'kind'='course' and p_guide->>'kind' in ('course','syllabus'))),false) then
  raise exception 'School source changed'; end if;
 guides:=coalesce(source.payload->'guideDocuments','[]');
 if jsonb_typeof(guides)<>'array' or jsonb_array_length(guides)>=50 or exists(select 1 from jsonb_array_elements(guides) g
  where g->>'documentId'=p_guide->>'documentId' and g->>'kind'=p_guide->>'kind') then raise exception 'Guide history full or duplicate'; end if;
 return query update public.cc_records set payload=jsonb_set(payload,'{guideDocuments}',guides||jsonb_build_array(p_guide))
  where id=source.id and owner_id=auth.uid() and version=p_version returning *;
end;
$$;
revoke all on function public.cc_append_private_school_guide(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.cc_append_private_school_guide(uuid,integer,integer,jsonb) to authenticated;
commit;
