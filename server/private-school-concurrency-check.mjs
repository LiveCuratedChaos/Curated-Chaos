// Trusted isolated-development QA only. Never reads credentials or owner record bodies.
import {randomUUID} from 'node:crypto';
import {makeSchoolDegree,makeSchoolCourse} from '../src/dev-school-model.mjs';
export function privateSchoolConcurrencyCheck(){
 const [degree,course,session]=Array.from({length:3},()=>randomUUID());
 const applicationName='cc-school-qa-'+randomUUID(),contenderName='cc-school-qa-'+randomUUID(),ids=`'${degree}','${course}'`,literal=p=>"'"+JSON.stringify({...p,schemaVersion:1}).replaceAll("'","''")+"'::jsonb";
 const degreePayload=literal(makeSchoolDegree(randomUUID(),{title:'Fictional concurrency program'}).payload),coursePayload=literal({...makeSchoolCourse(randomUUID(),{title:'Fictional concurrency course'}).payload,program:''});
 const claims=`perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${session}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';`;
 const sessionActor=`select user_id into a from auth.sessions where id='${session}';if a is null then raise exception 'Fictional QA session unavailable';end if;${claims}`;
 const prefix="begin;set local statement_timeout='25s';set local lock_timeout='15s';";
 const finish=result=>`commit;select '${result}' as school_concurrency_check,pg_backend_pid() as backend_pid;`;
 const setupSql=`${prefix}do $$declare a uuid;begin
 if exists(select 1 from public.cc_records where id in (${ids})) or exists(select 1 from auth.sessions where id='${session}') then raise exception 'Fresh fictional QA identity collision';end if;
 select id into a from auth.users order by id limit 1;if a is null then raise exception 'Established development QA identity required';end if;
 insert into auth.sessions(id,user_id) values('${session}',a);${claims}
 if public.cc_private_school_records_ready() is distinct from true then raise exception 'Reviewed School schema unavailable';end if;
 perform public.create_private_school_record('${degree}','degree',${degreePayload});perform public.create_private_school_record('${course}','course',${coursePayload});execute 'reset role';end$$;${finish('fixtures ready')}`;
 const holdDeletionSql=`${prefix}set local application_name='${applicationName}';do $$declare a uuid;begin ${sessionActor} perform cc_private.school_lock(a);perform pg_sleep(12);update public.cc_records set deleted_at=statement_timestamp() where id='${degree}' and version=1;if not found then raise exception 'Fictional program changed';end if;end$$;${finish('deletion committed')}`;
 const rejectedLinkSql=`${prefix}set local application_name='${contenderName}';do $$declare a uuid;begin ${sessionActor}
 begin perform public.set_private_school_program('${course}',1,'','${degree}',1);raise exception using errcode='P9999',message='Concurrent link unexpectedly succeeded';exception when sqlstate 'P0001' then if sqlerrm not like '%program changed%' then raise;end if;end;
 if not exists(select 1 from public.cc_records where id='${course}' and version=1 and payload->>'degreeId'='') then raise exception 'Rejected link changed course';end if;end$$;${finish('stale concurrent link refused')}`;
 const probeSql=`select exists(select 1 from pg_catalog.pg_stat_activity a join pg_catalog.pg_locks l on l.pid=a.pid where a.application_name='${applicationName}' and l.locktype='advisory' and l.granted) as holder_ready;`;
 const waitingProbeSql=`select exists(select 1 from pg_catalog.pg_locks held join pg_catalog.pg_stat_activity h on h.pid=held.pid join pg_catalog.pg_locks waiting on waiting.locktype=held.locktype and waiting.classid=held.classid and waiting.objid=held.objid and waiting.objsubid=held.objsubid and waiting.database is not distinct from held.database join pg_catalog.pg_stat_activity w on w.pid=waiting.pid where held.locktype='advisory' and held.granted and not waiting.granted and h.application_name='${applicationName}' and w.application_name='${contenderName}' and h.pid<>w.pid) as observed_concurrent_wait;`;
 const cleanupSql=`${prefix}do $$begin
 if exists(select 1 from public.cc_records where id in (${ids}) and (section<>'School' or item_type<>'school_fixture' or origin<>'M2E_SCHOOL_QA' or payload->'fictional' is distinct from 'true'::jsonb)) then raise exception 'Unexpected fictional QA record identity; cleanup refused';end if;
 delete from public.cc_records where id='${course}';delete from public.cc_records where id='${degree}';delete from auth.sessions where id='${session}';end$$;commit;
 select (select count(*)::int from public.cc_records where id in (${ids})) as remaining_qa_records,(select count(*)::int from auth.sessions where id='${session}') as remaining_qa_sessions;`;
 return{degreeId:degree,courseId:course,sessionId:session,applicationName,contenderName,setupSql,holdDeletionSql,rejectedLinkSql,probeSql,waitingProbeSql,cleanupSql};
}
