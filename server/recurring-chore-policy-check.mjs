// Rollback-only verification against two existing development users; no user creation/JWTs.
import {randomUUID} from 'node:crypto';
export function recurringChorePolicyCheck({runId=randomUUID()}={}){
 if(typeof runId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId))throw Error('Fictional verification identity required.');
 const source=randomUUID(),next=randomUUID(),collisionSource=randomUUID(),sessionA=randomUUID(),sessionB=randomUUID(),operation=randomUUID();
 const sql=`begin;
do $$
declare a uuid;b uuid;today date:=(timezone('America/New_York',statement_timestamp()))::date;rule jsonb;result jsonb;replayed jsonb;before_next jsonb;source_payload jsonb;rows_changed integer;
begin
 select id into a from auth.users order by id limit 1;select id into b from auth.users order by id offset 1 limit 1;
 if a is null or b is null or a=b then raise exception 'Two existing development users required';end if;
 insert into auth.sessions(id,user_id) values('${sessionA}',a),('${sessionB}',b);
 rule:=jsonb_build_object('anchorDay',(today-2)::text,'frequency','daily','interval',1);
 source_payload:=jsonb_build_object('title','Fictional recurring verification','day',(today-2)::text,'done',false,'status','Not Started','fictional',true,'description','Fictional verification only','priority','High','subtasks',jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'title','Fictional completed step','done',true)));
 insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values('${source}',a,'private','Home','task','RECURRING_ROLLBACK_QA_${runId}',source_payload),('${collisionSource}',a,'private','Home','task','RECURRING_ROLLBACK_QA_${runId}',source_payload);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a::text,'session_id','${sessionA}')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 result:=public.cc_complete_recurring_chore('${source}',1,rule,today+1,today,'${operation}','${next}');
 if result->'alreadySaved'<>'false'::jsonb or result->'completedRecord'->'payload'->'subtasks'<>source_payload->'subtasks' or result->'nextRecord'->'payload'->'subtasks'->0->'done'<>'false'::jsonb or result->'nextRecord'->'payload'->'subtasks'->0->>'id'=source_payload->'subtasks'->0->>'id' then raise exception 'Atomic completion/checklist verification failed';end if;
 replayed:=public.cc_complete_recurring_chore('${source}',1,rule,today+1,today,'${operation}','${next}');
 if replayed->'alreadySaved'<>'true'::jsonb or replayed->'nextRecord'->>'id'<>'${next}' or (select count(*) from public.cc_records where payload->>'recurrence_predecessor'='${source}')<>1 then raise exception 'Exact replay created a duplicate';end if;
 begin perform public.cc_complete_recurring_chore('${source}',1,rule,today+1,today,gen_random_uuid(),gen_random_uuid());raise exception using errcode='P9999',message='Competing review accepted';exception when sqlstate 'P0001' then null;end;
 begin perform public.cc_complete_recurring_chore('${collisionSource}',1,rule,today+1,today,gen_random_uuid(),'${source}');raise exception using errcode='P9999',message='Successor collision accepted';exception when unique_violation then null;end;
 if not exists(select 1 from public.cc_records where id='${collisionSource}' and version=1 and payload=source_payload) then raise exception 'Failed insertion left completion saved';end if;
 select to_jsonb(r) into before_next from public.cc_records r where id='${next}';
 update public.cc_records set payload=payload||'{"done":false,"status":"Not Started"}'::jsonb where id='${source}';update public.cc_records set payload=payload||'{"done":true,"status":"Completed"}'::jsonb where id='${source}';
 if (select to_jsonb(r) from public.cc_records r where id='${next}') is distinct from before_next then raise exception 'Reopened history changed the successor';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b::text,'session_id','${sessionB}')::text,true);perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.cc_records where id in ('${source}','${next}','${collisionSource}')) then raise exception 'Other account can read private QA chores';end if;
 begin perform public.cc_complete_recurring_chore('${source}',1,rule,today+1,today,gen_random_uuid(),gen_random_uuid());raise exception using errcode='P9999',message='Other account can complete private chore';exception when sqlstate 'P0001' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a::text,'session_id',gen_random_uuid()::text)::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.cc_complete_recurring_chore('${collisionSource}',1,rule,today+1,today,gen_random_uuid(),gen_random_uuid());raise exception using errcode='P9999',message='Missing session accepted';exception when sqlstate 'P0001' then null;end;
 execute 'reset role';
end $$;
rollback;
select 'passed' as recurring_checks,not exists(select 1 from public.cc_records where id in ('${source}','${next}','${collisionSource}')) as no_qa_records_saved,not exists(select 1 from auth.sessions where id in ('${sessionA}','${sessionB}')) as no_qa_sessions_saved;`;
 return{runId,sql,records:3,sessions:2,rollbackOnly:true};
}
