begin;

-- RLS on all three tables remains authoritative. A household ID only selects
-- among the signed-in account's active memberships.
create function public.cc_household_hub_choices()
returns table(household_id uuid, name text, is_owner boolean)
language sql stable security invoker set search_path = ''
as $$
  select h.id,h.name,h.owner_id=(select auth.uid())
  from public.cc_households h
  join public.cc_household_memberships m on m.household_id=h.id
  where m.user_id=(select auth.uid()) and m.status='active'
  order by h.name,h.id
  limit 101;
$$;

create function public.cc_household_hub_totals(p_household uuid)
returns table(section text, item_type text, total bigint, owned bigint)
language sql stable security invoker set search_path = ''
as $$
  select r.section,r.item_type,count(*),
         count(*) filter (where r.owner_id=(select auth.uid()))
  from public.cc_records r
  join public.cc_households h on h.id=r.household_id
  join public.cc_household_memberships m on m.household_id=h.id
  where h.id=p_household and m.user_id=(select auth.uid()) and m.status='active'
    and r.visibility='household' and r.deleted_at is null
    and r.item_type in ('task','note','event')
  group by r.section,r.item_type
  order by r.section,r.item_type;
$$;

revoke all on function public.cc_household_hub_choices(), public.cc_household_hub_totals(uuid) from public, anon;
grant execute on function public.cc_household_hub_choices(), public.cc_household_hub_totals(uuid) to authenticated;

commit;
