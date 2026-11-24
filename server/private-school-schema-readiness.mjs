// Generate fail-closed catalog readiness from reviewed local SQL, never from record data.
import {createHash} from 'node:crypto';
const signatures=Object.freeze({'cc_private.school_text':'jsonb,integer,boolean','cc_private.school_day':'jsonb','cc_private.school_number':'jsonb,numeric,boolean','cc_private.school_uuid':'text','cc_private.school_payload':'jsonb','cc_private.school_record':'public.cc_records','cc_private.school_lock':'uuid','cc_private.school_statement_lock':'','cc_private.school_guard':'','public.create_private_school_record':'uuid,text,jsonb,uuid,integer','public.set_private_school_program':'uuid,integer,text,uuid,integer'});
function definitions(sql){if(typeof sql!=='string')throw Error('Reviewed SQL source required.');return[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_]+\.[a-z_]+)\s*\([\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)].map(m=>({name:m[1],hash:createHash('md5').update(m[2]).digest('hex')}));}
export function privateSchoolSchemaManifest({schoolSql,baseSql}){const found=definitions(schoolSql),scope=definitions(baseSql).filter(d=>d.name==='cc_private.protect_record_scope');if(found.length!==Object.keys(signatures).length||new Set(found.map(d=>d.name)).size!==found.length||found.some(d=>!Object.hasOwn(signatures,d.name))||scope.length!==1)throw Error('Complete reviewed School and immutable-scope definitions required.');return[...found.map(d=>({...d,signature:d.name+'('+signatures[d.name]+')',authenticatedExecute:!['cc_private.school_statement_lock','cc_private.school_guard'].includes(d.name)})),{...scope[0],signature:'cc_private.protect_record_scope()',authenticatedExecute:false}];}
export function privateSchoolReadinessSql(sources){const manifest=privateSchoolSchemaManifest(sources),values=manifest.map(d=>`('${d.signature}','${d.hash}',${d.authenticatedExecute})`).join(',\n'),names=manifest.map(d=>"'"+d.name+"'").join(',');return`-- Generated from reviewed local function bodies. No record data or credentials.\ncreate function public.cc_private_school_records_ready() returns boolean language sql stable set search_path='' as $$
select auth.uid() is not null and cc_private.development_session_active()
 and coalesce((select relrowsecurity from pg_catalog.pg_class where oid='public.cc_records'::regclass),false)
 and not exists(select 1 from (values ${values}) expected(signature,body_hash,authenticated_execute)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where p.oid is null or pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef
 or p.proconfig is distinct from array['search_path=""']::text[]
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)
 and (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in (${names}))=${manifest.length}
 and (select count(*) from pg_catalog.pg_trigger t where t.tgrelid='public.cc_records'::regclass and not t.tgisinternal and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and ((t.tgname='cc_school_guard' and t.tgfoid=pg_catalog.to_regprocedure('cc_private.school_guard()') and t.tgtype=31) or(t.tgname='cc_school_statement_lock' and t.tgfoid=pg_catalog.to_regprocedure('cc_private.school_statement_lock()') and t.tgtype=30) or(t.tgname='cc_protect_scope' and t.tgfoid=pg_catalog.to_regprocedure('cc_private.protect_record_scope()') and t.tgtype=19)))=3;
$$;
revoke all on function public.cc_private_school_records_ready() from public,anon,authenticated;
grant execute on function public.cc_private_school_records_ready() to authenticated;
create function public.cc_private_school_tombstone_restore_ready() returns boolean language sql stable set search_path='' as $$
 select public.cc_private_school_records_ready() and exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('cc_private.school_guard()') and pg_catalog.md5(prosrc)='${manifest.find(d=>d.name==='cc_private.school_guard').hash}');
$$;
revoke all on function public.cc_private_school_tombstone_restore_ready() from public,anon,authenticated;
grant execute on function public.cc_private_school_tombstone_restore_ready() to authenticated;
`;}
