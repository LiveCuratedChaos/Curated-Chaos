// Derive narrow, reversible lock-order changes from reviewed historical sources.
// Never reads a database definition and treats it as a trusted replacement.
import {createHash} from 'node:crypto';
const names=[['public.cc_set_task_project_link','uuid,integer,uuid,integer,integer,boolean',' select * into t from public.cc_records where id=p_task_id and owner_id=actor',false],['public.cc_complete_recurring_chore','uuid,integer,jsonb,date,date,uuid,uuid',' select * into source_row from',false],['public.cc_set_project_hierarchy_link','uuid,integer,uuid,integer,integer,boolean',' perform pg_catalog.pg_advisory_xact_lock',true]];
const hash=body=>createHash('md5').update(body).digest('hex');
function definition(sql,name){if(typeof sql!=='string')throw Error('Reviewed legacy writer source required.');const found=[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_]+\.[a-z_]+)\s*\([\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)].filter(m=>m[1]===name);if(found.length!==1)throw Error('One exact legacy writer definition required.');return found[0];}
export function commonTaskLegacyLockOrder({manualMembershipSql,hierarchySql}){
 const definitions=names.map(([name,args,anchor,optional])=>{const m=definition(optional?hierarchySql:manualMembershipSql,name),body=m[2];if(body.includes('cc_private.school_lock(')||body.split(anchor).length!==2||m[0].includes('$cc_lock_'))throw Error('Reviewed unmodified legacy lock-order source required.');const patched=body.replace(anchor,' perform cc_private.school_lock(actor);\n'+anchor),original=m[0].replace(/^create\s+(?:or\s+replace\s+)?function/i,'create or replace function');return{name,signature:name+'('+args+')',optional,originalHash:hash(body),hash:hash(patched),original,patched:original.replace(body,patched)};});
 function script(undo){const statements=definitions.map(d=>{const expected=undo?d.hash:d.originalHash,source=undo?d.original:d.patched;return`do $cc_lock_check$ begin
 if ${d.optional?`pg_catalog.to_regprocedure('${d.signature}') is not null`:'true'} then
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('${d.signature}') and pg_catalog.md5(p.prosrc)='${expected}' and not p.prosecdef and p.prokind='f' and p.provolatile='v' and p.proconfig=array['search_path=""']::text[] and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Legacy writer differs from the reviewed lock-order source';end if;
 end if;
end $cc_lock_check$;
${d.optional?`do $cc_lock_apply$ begin if pg_catalog.to_regprocedure('${d.signature}') is not null then execute $cc_lock_definition$${source}$cc_lock_definition$;end if;end $cc_lock_apply$;`:source}`;});return`-- OFFLINE ${undo?'INVERSE':'PREPARATION'}: preserve writer signatures, privileges and behavior; ${undo?'restore original bodies':'acquire the School owner lock before row/hierarchy locks'}.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
${undo?`do $$begin if exists(select 1 from public.cc_records where item_type='common_task_link' or origin='PRIVATE_COOKIE_COMMON_TASK_LINK') or pg_catalog.to_regprocedure('public.cc_private_common_task_links_ready()') is not null then raise exception 'Retained canonical writers require their consistent lock order';end if;end$$;`:"do $$begin if pg_catalog.to_regprocedure('cc_private.school_lock(uuid)') is null then raise exception 'Reviewed School owner serialization is required';end if;end$$;"}
${statements.join('\n\n')}
commit;
`;}
 return{definitions,forward:script(false),inverse:script(true)};
}
