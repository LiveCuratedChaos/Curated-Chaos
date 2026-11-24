-- The selected source snapshot stays unchanged. The annotation is one separately sealed owner record.
begin;
create function public.cc_save_transaction_categories(p_source uuid,p_source_version integer,p_annotation uuid,p_prior_version integer,p_payload jsonb)
returns setof public.cc_records language plpgsql security invoker set search_path='' as $$
declare owner uuid := auth.uid();
begin
 if owner is null or not cc_private.development_session_active() or p_annotation is null or p_prior_version is null or p_prior_version<0
    or jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'scheme' is distinct from 'manual-finance-v1'
    or jsonb_typeof(p_payload->'encrypted') is distinct from 'string' or p_payload->>'encrypted'=''
    or (p_payload - array['scheme','encrypted']) <> '{}'::jsonb then raise exception 'Reviewed categories required'; end if;
 perform 1 from public.cc_records where id=p_source and owner_id=owner and version=p_source_version
   and section='Finances' and visibility='private' and household_id is null and deleted_at is null
   and item_type='provider_bank_transaction' and origin='plaid_readonly' for share;
 if not found then raise exception 'Selected transaction changed'; end if;
 if p_prior_version=0 then
  return query insert into public.cc_records(id,owner_id,section,visibility,item_type,origin,payload)
   values(p_annotation,owner,'Finances','private','manual_transaction_categories','PRIVATE_MANUAL_FINANCE',p_payload) returning *;
 else
  return query update public.cc_records set payload=p_payload where id=p_annotation and owner_id=owner and version=p_prior_version
   and section='Finances' and visibility='private' and household_id is null and deleted_at is null
   and item_type='manual_transaction_categories' and origin='PRIVATE_MANUAL_FINANCE' returning *;
 end if;
end;
$$;
revoke all on function public.cc_save_transaction_categories(uuid,integer,uuid,integer,jsonb) from public,anon;
grant execute on function public.cc_save_transaction_categories(uuid,integer,uuid,integer,jsonb) to authenticated;
commit;
