// Exact catalog binding generated from reviewed local sources, never from record contents.
import {createHash} from 'node:crypto';
const specs={'cc_private.school_recovery_active_ids':{args:'jsonb',returns:'text[]',volatility:'i',language:'plpgsql',execute:true},'cc_private.school_recovery_time':{args:'jsonb',returns:'timestamp with time zone',volatility:'i',language:'plpgsql',execute:true},'cc_private.school_recovery_payload':{args:'jsonb',returns:'boolean',volatility:'s',language:'plpgsql',execute:true},'cc_private.school_recovery_guard':{args:'',returns:'trigger',volatility:'v',language:'plpgsql',execute:false},'public.cc_private_school_records_ready':{args:'',returns:'boolean',volatility:'s',language:'sql',execute:true},'public.cc_private_school_tombstone_restore_ready':{args:'',returns:'boolean',volatility:'s',language:'sql',execute:true}};
function definitions(sql){if(typeof sql!=='string')throw Error('Reviewed recovery SQL required.');return[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_]+\.[a-z_]+)\s*\([\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)].map(m=>({name:m[1],hash:createHash('md5').update(m[2]).digest('hex')}));}
export function privateSchoolRecoverySchemaManifest({recoverySql,schoolReadinessSql}){const own=definitions(recoverySql),base=definitions(schoolReadinessSql);if(own.length!==4||own.some(d=>!d.name.startsWith('cc_private.school_recovery_'))||base.length!==2||base.some(d=>!['public.cc_private_school_records_ready','public.cc_private_school_tombstone_restore_ready'].includes(d.name)))throw Error('Complete reviewed recovery and School readiness sources required.');const all=[...own,...base];if(new Set(all.map(d=>d.name)).size!==6||all.some(d=>!Object.hasOwn(specs,d.name)))throw Error('Exact reviewed recovery functions required.');return all.map(d=>({...d,...specs[d.name],signature:d.name+'('+specs[d.name].args+')'}));}
export function privateSchoolRecoveryReadinessSql(sources){const all=privateSchoolRecoverySchemaManifest(sources),values=all.map(d=>`('${d.signature}','${d.hash}',${d.execute},'${d.returns}','${d.volatility}','${d.language}')`).join(',\n'),names=all.map(d=>"'"+d.name+"'").join(',');return`-- Generated from exact reviewed recovery and existing School readiness bodies.\ncreate function public.cc_private_school_recovery_ready() returns boolean language sql stable set search_path='' as $$
select coalesce(public.cc_private_school_records_ready(),false)
 and not exists(select 1 from(values ${values}) expected(signature,body_hash,authenticated_execute,result_type,volatility,language)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where p.oid is null or pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef or p.prokind<>'f'
 or p.proconfig is distinct from array['search_path=""']::text[]
 or p.prorettype<>pg_catalog.to_regtype(expected.result_type) or p.provolatile::text<>expected.volatility
 or p.prolang<>(select oid from pg_catalog.pg_language where lanname=expected.language)
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)
 and(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in(${names}))=6
 and(select count(*) from pg_catalog.pg_trigger t where t.tgrelid='public.cc_records'::regclass and t.tgname='cc_school_academic_recovery_guard' and not t.tgisinternal and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and t.tgtype=23 and t.tgfoid=pg_catalog.to_regprocedure('cc_private.school_recovery_guard()'))=1;
$$;
revoke all on function public.cc_private_school_recovery_ready() from public,anon,authenticated;
grant execute on function public.cc_private_school_recovery_ready() to authenticated;
`;}
