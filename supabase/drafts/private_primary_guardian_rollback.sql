begin;
lock table cc_private.child_guardian_profiles,cc_private.designated_guardians in access exclusive mode;
do $$
begin
 if exists (select 1 from cc_private.child_guardian_profiles) then
  raise exception 'Cannot remove guardian storage while profiles are retained';
 end if;
end;
$$;
drop function cc_private.can_manage_child_guardians(uuid);
drop table cc_private.designated_guardians;
drop table cc_private.child_guardian_profiles;
commit;
