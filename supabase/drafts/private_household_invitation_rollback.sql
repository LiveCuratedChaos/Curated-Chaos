begin;
lock table cc_private.household_invitations in access exclusive mode;
do $$
begin
 if exists (select 1 from cc_private.household_invitations) then
  raise exception 'Cannot remove invitation storage while invitations are retained';
 end if;
end;
$$;
drop function public.cc_accept_household_invitation(text);
drop table cc_private.household_invitations;
commit;
