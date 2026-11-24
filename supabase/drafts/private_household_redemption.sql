begin;

-- Integer points only. No cash, provider actions or grants to read balances.
-- Creation and funding remain private until the request/earn workflows exist.
create table cc_private.household_point_accounts (
 household_id uuid not null references public.cc_households(id),
 account_id uuid not null default gen_random_uuid(),
 balance integer not null check (balance>=0),
 primary key(household_id,account_id)
);
create table cc_private.household_redemptions (
 household_id uuid not null,
 id uuid not null default gen_random_uuid(),
 account_id uuid not null,
 cost integer not null check (cost>0),
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 primary key(household_id,id),
 foreign key(household_id,account_id)
  references cc_private.household_point_accounts(household_id,account_id),
 check ((approved_at is null)=(approved_by is null))
);
revoke all on cc_private.household_point_accounts,cc_private.household_redemptions from public,anon,authenticated;

create function public.cc_approve_household_redemption(p_household uuid,p_request uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare request cc_private.household_redemptions%rowtype;
begin
 perform 1 from public.cc_household_memberships
  where household_id=p_household and user_id=auth.uid() and status='active'
  for share;
 if not found then return false; end if;
 perform 1 from cc_private.household_approvers
  where household_id=p_household and user_id=auth.uid() for share;
 if not found or not cc_private.can_approve_household_rewards(p_household) then return false; end if;

 select * into request from cc_private.household_redemptions
  where household_id=p_household and id=p_request for update;
 if not found then return false; end if;
 if request.approved_at is not null then return true; end if;

 update cc_private.household_point_accounts set balance=balance-request.cost
  where household_id=p_household and account_id=request.account_id and balance>=request.cost;
 if not found then return false; end if;

 update cc_private.household_redemptions set approved_at=pg_catalog.now(),approved_by=auth.uid()
  where household_id=p_household and id=p_request;
 return true;
end;
$$;
revoke all on function public.cc_approve_household_redemption(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cc_approve_household_redemption(uuid,uuid) to authenticated;

commit;
