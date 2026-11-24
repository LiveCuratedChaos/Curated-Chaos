begin;

create table public.cc_household_comments (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.cc_records(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id),
 body text not null check (char_length(btrim(body)) between 1 and 2000 and char_length(body)<=2000),
 created_at timestamptz not null default now()
);
create index cc_household_comments_source on public.cc_household_comments(source_id,created_at,id);
alter table public.cc_household_comments enable row level security;
revoke all on public.cc_household_comments from public,anon,authenticated;
grant select on public.cc_household_comments to authenticated;
grant insert(source_id,body) on public.cc_household_comments to authenticated;

-- The source row must still be visible under its own policy. Authors retain
-- no special read access if the source is removed or permission is revoked.
create policy cc_household_comments_read on public.cc_household_comments for select to authenticated
 using (cc_private.development_session_active() and exists (
  select 1 from public.cc_records r where r.id=source_id and r.visibility='household'
   and r.household_id is not null and r.deleted_at is null and r.item_type in ('task','note','event')
 ));
create policy cc_household_comments_add on public.cc_household_comments for insert to authenticated
 with check (author_id=(select auth.uid()) and cc_private.development_session_active() and exists (
  select 1 from public.cc_records r where r.id=source_id and r.visibility='household'
   and r.household_id is not null and r.deleted_at is null and r.item_type in ('task','note','event')
   and cc_private.can_access(r.household_id,r.section,true)
 ));

commit;
