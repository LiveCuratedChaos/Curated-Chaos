begin;

-- An identity boundary for fictional profiles only. This draft does not enroll
-- users, create child sign-in sessions or give guardians access to private records.
create table cc_private.child_guardian_profiles (
 id uuid primary key default gen_random_uuid(),
 primary_guardian_id uuid not null references auth.users(id),
 independent_adult_at timestamptz
);
create table cc_private.designated_guardians (
 child_id uuid not null references cc_private.child_guardian_profiles(id) on delete cascade,
 guardian_id uuid not null references auth.users(id),
 primary key(child_id,guardian_id)
);
revoke all on cc_private.child_guardian_profiles,cc_private.designated_guardians from public,anon,authenticated;

create function cc_private.can_manage_child_guardians(p_child uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select cc_private.development_session_active() and exists (
  select 1 from cc_private.child_guardian_profiles c
  where c.id=p_child and c.primary_guardian_id=(select auth.uid())
    and c.independent_adult_at is null
 );
$$;
revoke all on function cc_private.can_manage_child_guardians(uuid) from public,anon,authenticated;
grant execute on function cc_private.can_manage_child_guardians(uuid) to authenticated;

commit;
