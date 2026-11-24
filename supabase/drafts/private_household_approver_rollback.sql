begin;
lock table public.cc_household_memberships,cc_private.household_approvers in access exclusive mode;
do $$
begin
 if exists (select 1 from cc_private.household_approvers) then
  raise exception 'Cannot remove household approver storage while grants are retained';
 end if;
end;
$$;
drop trigger cc_clear_departed_household_approver on public.cc_household_memberships;
drop function cc_private.clear_departed_household_approver();
drop function cc_private.can_approve_household_rewards(uuid);
drop table cc_private.household_approvers;
commit;
