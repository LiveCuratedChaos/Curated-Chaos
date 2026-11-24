begin;
lock table public.cc_household_comments in access exclusive mode;
do $$
begin
 if exists (select 1 from public.cc_household_comments) then
  raise exception 'Cannot remove household comments storage while comments are retained';
 end if;
end;
$$;
drop table public.cc_household_comments;
commit;
