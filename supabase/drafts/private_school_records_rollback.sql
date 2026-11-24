-- PREPARED ONLY. No data deletion; active association history prevents guard removal.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$begin if current_setting('transaction_isolation')<>'read committed' then raise exception 'School rollback requires read committed';end if;end$$;
lock table public.cc_records in access exclusive mode;
do $$declare actual text;expected text:=current_setting('cc.school_rollback_association_digest',true);n bigint;begin
 select count(*),md5(coalesce(string_agg(concat_ws('|',id::text,owner_id::text,coalesce(payload->>'degreeId',''),coalesce(deleted_at::text,'active')),E'\n' order by id),'')) into n,actual from public.cc_records where item_type='school_fixture' and payload->>'kind'='course' and coalesce(payload->>'degreeId','')<>'';
 if n>0 and (coalesce(expected,'')='' or expected<>actual) then raise exception 'Retained School associations require a matching reviewed baseline digest before rollback';end if;
end$$;
drop function if exists public.cc_private_school_tombstone_restore_ready();
drop function if exists public.cc_private_school_records_ready();
drop function public.set_private_school_program(uuid,integer,text,uuid,integer);
drop function public.create_private_school_record(uuid,text,jsonb,uuid,integer);
drop trigger cc_school_guard on public.cc_records;
drop trigger cc_school_statement_lock on public.cc_records;
drop function cc_private.school_guard();
drop function cc_private.school_statement_lock();
drop function cc_private.school_lock(uuid);
drop function cc_private.school_record(public.cc_records);
drop function cc_private.school_payload(jsonb);
drop function cc_private.school_uuid(text);
drop function cc_private.school_number(jsonb,numeric,boolean);
drop function cc_private.school_day(jsonb);
drop function cc_private.school_text(jsonb,integer,boolean);
commit;
