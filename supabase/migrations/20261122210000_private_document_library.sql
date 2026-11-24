-- Original owner-private documents. Additional record links point to one canonical file.
begin;
create table public.cc_private_documents (
 owner_id uuid not null references auth.users(id),
 id uuid not null,
 content_key text not null check (content_key ~ '^[0-9a-f]{64}$'),
 metadata text not null check (length(metadata) between 1 and 8192),
 file_envelope text not null check (length(file_envelope) between 1 and 11200000),
 version integer not null default 1 check (version>0),
 primary key(owner_id,id), unique(owner_id,content_key)
);
alter table public.cc_private_documents enable row level security;
create policy cc_document_owner_read on public.cc_private_documents for select to authenticated
 using (owner_id=auth.uid() and cc_private.development_session_active());
create policy cc_document_owner_add on public.cc_private_documents for insert to authenticated
 with check (owner_id=auth.uid() and cc_private.development_session_active() and version=1);
revoke all on public.cc_private_documents from public,anon,authenticated;
grant select,insert(owner_id,id,content_key,metadata,file_envelope) on public.cc_private_documents to authenticated;
commit;
