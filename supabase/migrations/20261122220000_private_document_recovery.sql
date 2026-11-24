begin;
-- Private SQL recovery adapter. Existing files can never be overwritten by this operation.
create function cc_private.restore_missing_document(
 p_owner uuid,p_id uuid,p_content_key text,p_metadata text,p_file_envelope text,p_version integer
) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_owner or
    not coalesce(cc_private.development_session_active(),false) then
  raise exception 'Active document owner required';
 end if;
 insert into public.cc_private_documents(owner_id,id,content_key,metadata,file_envelope,version)
 values(p_owner,p_id,p_content_key,p_metadata,p_file_envelope,p_version);
end;
$$;
revoke all on function cc_private.restore_missing_document(uuid,uuid,text,text,text,integer) from public,anon;
grant execute on function cc_private.restore_missing_document(uuid,uuid,text,text,text,integer) to authenticated;
commit;
