-- Generated from reviewed local function bodies. No record data or credentials.
create function public.cc_private_school_records_ready() returns boolean language sql stable set search_path='' as $$
select auth.uid() is not null and cc_private.development_session_active()
 and coalesce((select relrowsecurity from pg_catalog.pg_class where oid='public.cc_records'::regclass),false)
 and not exists(select 1 from (values ('cc_private.school_text(jsonb,integer,boolean)','0c6cd0f2b2ac08416afbd6a0adc76283',true),
('cc_private.school_day(jsonb)','7f07edf3f5c0d1c9fd099c114533836b',true),
('cc_private.school_number(jsonb,numeric,boolean)','ab9b3af139933cae1641eb8b98a1f6a5',true),
('cc_private.school_uuid(text)','65e12953c676e72d7a77b9151cce584c',true),
('cc_private.school_payload(jsonb)','397313d8c0adcc7dc3910d6ea374adbc',true),
('cc_private.school_record(public.cc_records)','3992e321ef99209cf2d32f4637e9efe6',true),
('cc_private.school_lock(uuid)','ec1e9f92b502276a2f46532dfee039b1',true),
('cc_private.school_statement_lock()','4fddabb1d6e67bf51729e4f8f38c2b5e',false),
('cc_private.school_guard()','7ca077aa5935670639e3d762ddffad2a',false),
('public.create_private_school_record(uuid,text,jsonb,uuid,integer)','24573382d6e2d90421bd12bb1a886617',true),
('public.set_private_school_program(uuid,integer,text,uuid,integer)','44655e71ca1de850e821c032368f4f2a',true),
('cc_private.protect_record_scope()','e5c757ea7faff37379875cb517060eb3',false)) expected(signature,body_hash,authenticated_execute)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where p.oid is null or pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef
 or p.proconfig is distinct from array['search_path=""']::text[]
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)
 and (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in ('cc_private.school_text','cc_private.school_day','cc_private.school_number','cc_private.school_uuid','cc_private.school_payload','cc_private.school_record','cc_private.school_lock','cc_private.school_statement_lock','cc_private.school_guard','public.create_private_school_record','public.set_private_school_program','cc_private.protect_record_scope'))=12
 and (select count(*) from pg_catalog.pg_trigger t where t.tgrelid='public.cc_records'::regclass and not t.tgisinternal and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and ((t.tgname='cc_school_guard' and t.tgfoid=pg_catalog.to_regprocedure('cc_private.school_guard()') and t.tgtype=31) or(t.tgname='cc_school_statement_lock' and t.tgfoid=pg_catalog.to_regprocedure('cc_private.school_statement_lock()') and t.tgtype=30) or(t.tgname='cc_protect_scope' and t.tgfoid=pg_catalog.to_regprocedure('cc_private.protect_record_scope()') and t.tgtype=19)))=3;
$$;
revoke all on function public.cc_private_school_records_ready() from public,anon,authenticated;
grant execute on function public.cc_private_school_records_ready() to authenticated;
create function public.cc_private_school_tombstone_restore_ready() returns boolean language sql stable set search_path='' as $$
 select public.cc_private_school_records_ready() and exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('cc_private.school_guard()') and pg_catalog.md5(prosrc)='7ca077aa5935670639e3d762ddffad2a');
$$;
revoke all on function public.cc_private_school_tombstone_restore_ready() from public,anon,authenticated;
grant execute on function public.cc_private_school_tombstone_restore_ready() to authenticated;
