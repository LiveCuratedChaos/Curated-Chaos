begin;
lock table cc_private.household_point_accounts,cc_private.household_redemptions in access exclusive mode;
do $$
begin
 if exists (select 1 from cc_private.household_point_accounts) then
  raise exception 'Cannot remove household points storage while balances or redemptions are retained';
 end if;
end;
$$;
drop function public.cc_approve_household_redemption(uuid,uuid);
drop table cc_private.household_redemptions;
drop table cc_private.household_point_accounts;
commit;
