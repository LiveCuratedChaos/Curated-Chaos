-- Generated from exact reviewed recovery and existing School readiness bodies.
create function public.cc_private_school_recovery_ready() returns boolean language sql stable set search_path='' as $$
select coalesce(public.cc_private_school_records_ready(),false)
 and not exists(select 1 from(values ('cc_private.school_recovery_active_ids(jsonb)','d7eae1c023044cef5f75fd8e3475d626',true,'text[]','i','plpgsql'),
('cc_private.school_recovery_time(jsonb)','a19415678a9e960f9cf15626c7d508bd',true,'timestamp with time zone','i','plpgsql'),
('cc_private.school_recovery_payload(jsonb)','fb65ea968c3e9a4ddae2168217209c43',true,'boolean','s','plpgsql'),
('cc_private.school_recovery_guard()','66fb62bfbb3eb162f7061d7c07421b5e',false,'trigger','v','plpgsql'),
('public.cc_private_school_records_ready()','67d8f1f98c851f5b4233ac3322ae4e20',true,'boolean','s','sql'),
('public.cc_private_school_tombstone_restore_ready()','fd573613e867e32e5e51b1e8ecce7745',true,'boolean','s','sql')) expected(signature,body_hash,authenticated_execute,result_type,volatility,language)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where p.oid is null or pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef or p.prokind<>'f'
 or p.proconfig is distinct from array['search_path=""']::text[]
 or p.prorettype<>pg_catalog.to_regtype(expected.result_type) or p.provolatile::text<>expected.volatility
 or p.prolang<>(select oid from pg_catalog.pg_language where lanname=expected.language)
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)
 and(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in('cc_private.school_recovery_active_ids','cc_private.school_recovery_time','cc_private.school_recovery_payload','cc_private.school_recovery_guard','public.cc_private_school_records_ready','public.cc_private_school_tombstone_restore_ready'))=6
 and(select count(*) from pg_catalog.pg_trigger t where t.tgrelid='public.cc_records'::regclass and t.tgname='cc_school_academic_recovery_guard' and not t.tgisinternal and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and t.tgtype=23 and t.tgfoid=pg_catalog.to_regprocedure('cc_private.school_recovery_guard()'))=1;
$$;
revoke all on function public.cc_private_school_recovery_ready() from public,anon,authenticated;
grant execute on function public.cc_private_school_recovery_ready() to authenticated;
