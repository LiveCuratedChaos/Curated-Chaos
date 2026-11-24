begin;

-- Approval authority is separate from membership permissions and guardianship.
-- Provisioning stays server-only until reviewed owner administration is wired.
create table cc_private.household_approvers (
 household_id uuid not null,
 user_id uuid not null,
 primary key(household_id,user_id),
 foreign key(household_id,user_id)
  references public.cc_household_memberships(household_id,user_id) on delete cascade
);
revoke all on cc_private.household_approvers from public,anon,authenticated;

create function cc_private.can_approve_household_rewards(p_household uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select cc_private.development_session_active() and exists (
  select 1 from cc_private.household_approvers a
  join public.cc_household_memberships m using(household_id,user_id)
  where a.household_id=p_household and a.user_id=(select auth.uid())
    and m.status='active' and m.role in ('adult','owner')
 );
$$;
revoke all on function cc_private.can_approve_household_rewards(uuid) from public,anon,authenticated;
grant execute on function cc_private.can_approve_household_rewards(uuid) to authenticated;

-- A departure invalidates the grant rather than saving it for a later rejoin.
create function cc_private.clear_departed_household_approver()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.status is distinct from 'active' then
  delete from cc_private.household_approvers
   where household_id=new.household_id and user_id=new.user_id;
 end if;
 return new;
end;
$$;
revoke all on function cc_private.clear_departed_household_approver() from public,anon,authenticated;
create trigger cc_clear_departed_household_approver after update of status
 on public.cc_household_memberships for each row execute function cc_private.clear_departed_household_approver();

commit;
