// Trusted fictional rollback-only acceptance. No credentials, providers or private record reads.
import {randomUUID} from 'node:crypto';
export function privateSchoolPolicyCheck(){
 const [d1,d2,course,sa,sb,absentSession]=Array.from({length:6},()=>randomUUID()),recordIds=[d1,d2,course],sessionIds=[sa,sb],quote=ids=>ids.map(id=>`'${id}'`).join(','),predicate=`id in (${quote(recordIds)})`,sessionPredicate=`id in (${quote(sessionIds)})`;
 const cleanupSql=`select (select count(*)::int from public.cc_records where ${predicate}) as remaining_qa_records,(select count(*)::int from auth.sessions where ${sessionPredicate}) as remaining_qa_sessions;`;
 return{records:3,sessions:2,rollbackOnly:true,recordIds,sessionIds,cleanupSql,sql:`begin;
set local statement_timeout='20s';set local lock_timeout='3s';
do $$declare a uuid;b uuid;d public.cc_records%rowtype;c public.cc_records%rowtype;p jsonb;before_payload jsonb;amount integer;begin
 if exists(select 1 from public.cc_records where ${predicate}) or exists(select 1 from auth.sessions where ${sessionPredicate}) then raise exception 'Fresh fictional QA identity collision';end if;
 select id into a from auth.users order by id limit 1;select id into b from auth.users order by id offset 1 limit 1;
 if a is null or b is null or a=b then raise exception 'Two established development QA identities required';end if;
 begin
 insert into auth.sessions(id,user_id) values('${sa}',a),('${sb}',b);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${sa}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 if public.cc_private_school_records_ready() is distinct from true then raise exception 'School guards are not ready';end if;
 p:='{"fictional":true,"source":"M2E_SCHOOL_QA","schemaVersion":1,"kind":"degree","title":"Fictional program QA A","progressMetric":"classes","totalCredits":0,"totalTerms":0,"targetDate":""}';
 d:=public.create_private_school_record('${d1}','degree',p);
 if d.id<>'${d1}' or d.owner_id<>a or d.visibility<>'private' or d.household_id is not null or d.version<>1 or d.payload is distinct from p then raise exception 'New program identity changed';end if;
 d:=public.create_private_school_record('${d2}','degree',p||'{"title":"Fictional program QA B"}'::jsonb);
 p:='{"fictional":true,"source":"M2E_SCHOOL_QA","schemaVersion":1,"kind":"course","title":"Fictional course QA","degreeId":"${d1}","program":"","code":"QA","term":"QA term","status":"Not Started","credits":3,"officialOrder":1,"studyOrder":2,"targetDate":"","notes":"","assessments":[],"studySessions":[]}';
 c:=public.create_private_school_record('${course}','course',p,'${d1}',1);
 if c.id<>'${course}' or c.owner_id<>a or c.version<>1 or c.payload is distinct from p then raise exception 'New course identity changed';end if;
 begin perform public.create_private_school_record('${course}','course',p,'${d1}',1);raise exception using errcode='P9999',message='Duplicate identity accepted';exception when unique_violation then null;end;
 update public.cc_records set payload=payload||'{"extension":{"literal":["Fictional preserved","<literal>"]}}'::jsonb where id='${course}' returning * into c;before_payload:=c.payload;
 begin perform public.set_private_school_program('${course}',1,'${d1}');raise exception using errcode='P9999',message='Stale course accepted';exception when sqlstate 'P0001' then null;end;
 begin perform public.set_private_school_program('${course}',2,'${d1}','${d2}',1);raise exception using errcode='P9999',message='Implicit reparent accepted';exception when sqlstate 'P0001' then null;end;
 begin update public.cc_records set deleted_at=statement_timestamp() where id='${d1}';raise exception using errcode='P9999',message='Referenced program deletion accepted';exception when sqlstate 'P0001' then null;end;
 c:=public.set_private_school_program('${course}',2,'${d1}');
 if c.version<>3 or c.payload is distinct from jsonb_set(before_payload,'{degreeId}','""'::jsonb) then raise exception 'Unlink changed unrelated content';end if;
 begin perform public.set_private_school_program('${course}',3,'','${d2}',2);raise exception using errcode='P9999',message='Stale program accepted';exception when sqlstate 'P0001' then null;end;
 c:=public.set_private_school_program('${course}',3,'','${d2}',1);
 if c.version<>4 or c.payload is distinct from jsonb_set(before_payload,'{degreeId}','"${d2}"'::jsonb) then raise exception 'Reparent changed unrelated content';end if;
 begin update public.cc_records set payload=jsonb_set(payload,'{degreeId}','"${d1}"'::jsonb) where id='${course}';raise exception using errcode='P9999',message='Direct reparent accepted';exception when sqlstate 'P0001' then null;end;
 begin update public.cc_records set deleted_at=statement_timestamp() where id='${d2}';raise exception using errcode='P9999',message='New referenced program deletion accepted';exception when sqlstate 'P0001' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id','${sb}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.cc_records where ${predicate}) then raise exception 'Other account can read QA records';end if;
 begin perform public.set_private_school_program('${course}',4,'${d2}');raise exception using errcode='P9999',message='Other account changed QA course';exception when sqlstate 'P0001' then null;end;
 update public.cc_records set deleted_at=statement_timestamp() where id='${course}';get diagnostics amount=row_count;if amount<>0 then raise exception 'Other account directly changed QA course';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${absentSession}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
 if public.cc_private_school_records_ready() is distinct from false then raise exception 'Missing session readiness accepted';end if;
 if exists(select 1 from public.cc_records where ${predicate}) then raise exception 'Missing session can read QA records';end if;
 begin perform public.set_private_school_program('${course}',4,'${d2}');raise exception using errcode='P9999',message='Missing session changed QA course';exception when sqlstate 'P0001' then null;end;
 execute 'reset role';
 if (select count(*) from public.cc_records where ${predicate})<>3 then raise exception 'Unexpected fictional QA footprint';end if;
 raise exception using errcode='P7777',message='ROLLBACK_PRIVATE_SCHOOL_QA_SUCCESS';
 exception when sqlstate 'P7777' then null;end;
 if exists(select 1 from public.cc_records where ${predicate}) or exists(select 1 from auth.sessions where ${sessionPredicate}) then raise exception 'Fictional School QA subtransaction did not roll back';end if;
end$$;
rollback;
select 'passed' as school_record_checks,3 as fictional_record_bound,2 as temporary_session_bound,
 not exists(select 1 from public.cc_records where ${predicate}) as no_qa_records_saved,
 not exists(select 1 from auth.sessions where ${sessionPredicate}) as no_qa_sessions_saved;`};
}
