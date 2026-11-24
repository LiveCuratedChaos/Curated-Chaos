-- Prepared for local verification. A posted transaction may match one bill occurrence per owner.
begin;
create unique index cc_unique_bill_transaction
 on public.cc_records (owner_id, (payload->>'matchKey'))
 where item_type='manual_bill_confirmation' and origin='PRIVATE_MANUAL_FINANCE' and payload->>'matchKey' is not null;

-- Lock the reviewed schedule and, for matches, the exact reviewed provider copy before inserting.
create function public.cc_record_bill_confirmation(p_bill uuid,p_bill_version integer,p_occurrence uuid,p_payload jsonb,p_transaction uuid,p_transaction_version integer)
returns setof public.cc_records language plpgsql security invoker set search_path='' as $$
declare
 owner uuid := auth.uid();
begin
 if owner is null or not cc_private.development_session_active() or p_bill is null or p_occurrence is null or
    p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or
    not (p_payload ?& array['billId','scheme','encrypted','matchKey']) or
    (p_payload - array['billId','scheme','encrypted','matchKey']) <> '{}'::jsonb or
    (p_payload->>'matchKey' is not null and
     p_payload->>'matchKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') or
    p_payload->>'billId' is distinct from p_bill::text or p_payload->>'scheme' is distinct from 'manual-finance-v1' or
    jsonb_typeof(p_payload->'encrypted') is distinct from 'string' or p_payload->>'encrypted'='' or
    (p_transaction is null) <> (p_transaction_version is null) or
    (p_transaction is null) <> (p_payload->>'matchKey' is null)
 then raise exception 'Invalid private bill confirmation'; end if;
 perform 1 from public.cc_records where owner_id=owner and id=p_bill and version=p_bill_version and
   visibility='private' and household_id is null and deleted_at is null and section='Finances'
   and item_type='manual_finance_bill' and origin='PRIVATE_MANUAL_FINANCE' for share;
 if not found then raise exception 'Bill changed'; end if;
 if p_transaction is not null then
  perform 1 from public.cc_records where owner_id=owner and id=p_transaction and version=p_transaction_version and
   visibility='private' and household_id is null and deleted_at is null and section='Finances'
   and item_type='provider_bank_transaction' and origin='plaid_readonly' for share;
  if not found then raise exception 'Transaction changed'; end if;
 end if;
 return query insert into public.cc_records (id,owner_id,visibility,section,item_type,origin,payload)
  values (p_occurrence,owner,'private','Finances','manual_bill_confirmation','PRIVATE_MANUAL_FINANCE',p_payload) returning *;
end;
$$;
revoke all on function public.cc_record_bill_confirmation(uuid,integer,uuid,jsonb,uuid,integer) from public,anon;
grant execute on function public.cc_record_bill_confirmation(uuid,integer,uuid,jsonb,uuid,integer) to authenticated;
commit;
