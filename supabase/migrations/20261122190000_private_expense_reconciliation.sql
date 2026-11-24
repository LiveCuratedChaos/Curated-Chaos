-- Insert one source match and update its one budget expense together.
begin;
create function public.cc_match_private_expense(p_source uuid,p_source_version integer,p_budget uuid,p_budget_version integer,
 p_budget_payload jsonb,p_match uuid,p_match_payload jsonb)
returns setof public.cc_records language plpgsql security invoker set search_path='' as $$
declare owner uuid := auth.uid(); envelope jsonb;
begin
 if owner is null or not cc_private.development_session_active() or p_budget is null or p_match is null then raise exception 'Reviewed match required'; end if;
 foreach envelope in array array[p_budget_payload,p_match_payload] loop
  if jsonb_typeof(envelope) is distinct from 'object' or envelope->>'scheme' is distinct from 'manual-finance-v1'
    or jsonb_typeof(envelope->'encrypted') is distinct from 'string' or envelope->>'encrypted'='' or
    (envelope - array['scheme','encrypted']) <> '{}'::jsonb then raise exception 'Invalid match payload'; end if;
 end loop;
 perform 1 from public.cc_records where id=p_source and owner_id=owner and version=p_source_version and section='Finances'
  and visibility='private' and household_id is null and deleted_at is null and item_type='provider_bank_transaction' and origin='plaid_readonly' for share;
 if not found then raise exception 'Source transaction changed'; end if;
 update public.cc_records set payload=p_budget_payload where id=p_budget and owner_id=owner and version=p_budget_version
  and section='Finances' and visibility='private' and household_id is null and deleted_at is null and item_type='manual_finance_budget' and origin='PRIVATE_MANUAL_FINANCE';
 if not found then raise exception 'Budget changed'; end if;
 return query insert into public.cc_records(id,owner_id,section,visibility,item_type,origin,payload)
  values(p_match,owner,'Finances','private','manual_expense_reconciliation','PRIVATE_MANUAL_FINANCE',p_match_payload) returning *;
end;
$$;
revoke all on function public.cc_match_private_expense(uuid,integer,uuid,integer,jsonb,uuid,jsonb) from public,anon;
grant execute on function public.cc_match_private_expense(uuid,integer,uuid,integer,jsonb,uuid,jsonb) to authenticated;
commit;
