-- CURATED CHAOS / M0B: DEVELOPMENT PROJECT ONLY (2026-10-30)
-- STOP: Never run this against the existing Curated Chaos Supabase project.
-- Apply ONLY after confirming a NEW project URL and project reference.
-- This intentionally implements a small, minimally privileged test foundation.
-- Production, child/guardian, integrations, invites, auditing and encrypted storage are NOT ready.

begin;

create schema if not exists cc_private;
revoke all on schema cc_private from public, anon, authenticated;
grant usage on schema cc_private to authenticated;

create table public.cc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Account',
  created_at timestamptz not null default now(),
  constraint cc_profile_name_length check (char_length(display_name) between 1 and 100)
);

create table public.cc_households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.cc_household_memberships (
  household_id uuid not null references public.cc_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','adult')),
  status text not null default 'active' check (status in ('active','removed')),
  read_sections text[] not null default '{}'::text[],
  write_sections text[] not null default '{}'::text[],
  primary key (household_id,user_id)
);

-- SECURITY DEFINER helpers are NOT exposed through the public Data API schema.
-- The authenticated identity always comes from auth.uid(), never from a user-provided ID.
create function cc_private.is_household_owner(hid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cc_households h
    where h.id = hid and h.owner_id = (select auth.uid())
  );
$$;

create function cc_private.can_access(hid uuid, target_section text, need_write boolean)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cc_households h
    join public.cc_household_memberships m on m.household_id = h.id
    where h.id = hid and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        h.owner_id = (select auth.uid())
        or (need_write and target_section = any(m.write_sections))
        or (not need_write and (target_section = any(m.read_sections)
                                     or target_section = any(m.write_sections)))
      )
  );
$$;

create function cc_private.is_active_member(hid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cc_household_memberships m
    where m.household_id = hid and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- Only a verified household owner may be created by the authenticated owner.
-- Direct membership editing by browser clients is never permitted.
create function cc_private.register_owner_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cc_household_memberships (household_id,user_id,role,status)
  values (new.id,new.owner_id,'owner','active');
  return new;
end;
$$;
create trigger cc_register_owner
  after insert on public.cc_households
  for each row execute function cc_private.register_owner_membership();

create table public.cc_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  household_id uuid references public.cc_households(id),
  visibility text not null default 'private' check (visibility in ('private','household')),
  section text not null check (section in (
    'Home','Calendar','Personal Life','Work','School','Finances'
  )),
  item_type text not null check (char_length(item_type) between 1 and 60),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  origin text not null default 'manual',
  version integer not null default 1 check (version >= 1),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cc_record_scope check (
    (visibility='private' and household_id is null)
    or (visibility='household' and household_id is not null)
  )
);
create index cc_records_owner_idx on public.cc_records(owner_id, section);
create index cc_records_household_idx on public.cc_records(household_id, section)
  where household_id is not null;

-- Prevent client updates from moving records between people/households/visibility.
create function cc_private.protect_record_scope()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.household_id is distinct from old.household_id
     or new.visibility is distinct from old.visibility
     or new.created_at is distinct from old.created_at then
    raise exception 'Record identity and sharing scope cannot be updated directly';
  end if;
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;
create trigger cc_protect_scope
  before update on public.cc_records
  for each row execute function cc_private.protect_record_scope();

-- RLS is enabled for EVERY public table created by this migration.
alter table public.cc_profiles enable row level security;
alter table public.cc_households enable row level security;
alter table public.cc_household_memberships enable row level security;
alter table public.cc_records enable row level security;

-- Explicit grants matter in addition to policies: no anonymous table access,
-- no direct membership changes, no household edit/delete, no hard-delete of records.
revoke all on table public.cc_profiles, public.cc_households,
  public.cc_household_memberships, public.cc_records from public, anon, authenticated;
grant select, insert, update on table public.cc_profiles to authenticated;
grant select, insert on table public.cc_households to authenticated;
grant select on table public.cc_household_memberships to authenticated;
grant select, insert, update on table public.cc_records to authenticated;

revoke all on function cc_private.is_household_owner(uuid) from public, anon, authenticated;
revoke all on function cc_private.is_active_member(uuid) from public, anon, authenticated;
revoke all on function cc_private.can_access(uuid,text,boolean) from public, anon, authenticated;
revoke all on function cc_private.register_owner_membership() from public, anon, authenticated;
revoke all on function cc_private.protect_record_scope() from public, anon, authenticated;
grant execute on function cc_private.is_household_owner(uuid) to authenticated;
grant execute on function cc_private.is_active_member(uuid) to authenticated;
grant execute on function cc_private.can_access(uuid,text,boolean) to authenticated;

create policy cc_profile_self_select on public.cc_profiles for select to authenticated
  using (user_id=(select auth.uid()));
create policy cc_profile_self_insert on public.cc_profiles for insert to authenticated
  with check (user_id=(select auth.uid()));
create policy cc_profile_self_update on public.cc_profiles for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy cc_household_member_select on public.cc_households for select to authenticated
  using (cc_private.is_active_member(id));
create policy cc_household_owner_insert on public.cc_households for insert to authenticated
  with check (owner_id=(select auth.uid()));

create policy cc_membership_self_or_owner_select on public.cc_household_memberships
  for select to authenticated
  using (user_id=(select auth.uid()) or cc_private.is_household_owner(household_id));

create policy cc_record_select on public.cc_records for select to authenticated
  using ((visibility='private' and owner_id=(select auth.uid())) or
    (visibility='household' and cc_private.can_access(household_id,section,false)));
create policy cc_record_insert on public.cc_records for insert to authenticated
  with check (owner_id=(select auth.uid()) and
    ((visibility='private' and household_id is null) or
    (visibility='household' and cc_private.can_access(household_id,section,true))));
create policy cc_record_update on public.cc_records for update to authenticated
  using ((visibility='private' and owner_id=(select auth.uid())) or
    (visibility='household' and cc_private.can_access(household_id,section,true)))
  with check ((visibility='private' and owner_id=(select auth.uid())) or
    (visibility='household' and cc_private.can_access(household_id,section,true)));

comment on table public.cc_records is
  'M0B DEVELOPMENT ONLY: fictional test records; not production; no provider tokens or sensitive data.';
commit;
