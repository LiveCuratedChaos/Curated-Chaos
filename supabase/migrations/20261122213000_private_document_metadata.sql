begin;

-- An owner may change the encrypted description without replacing the original file.
create policy cc_document_owner_organize on public.cc_private_documents
for update to authenticated
using (owner_id = auth.uid() and cc_private.development_session_active())
with check (owner_id = auth.uid() and cc_private.development_session_active());

create function cc_private.check_document_metadata_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.version <> old.version + 1 or new.metadata = old.metadata then
   raise exception 'Document metadata requires a new revision';
 end if;
 return new;
end;
$$;
revoke all on function cc_private.check_document_metadata_revision() from public;
create trigger cc_document_metadata_revision before update of metadata, version
on public.cc_private_documents for each row
execute function cc_private.check_document_metadata_revision();

grant update (metadata, version) on public.cc_private_documents to authenticated;
commit;
