// Trusted rollback-only SQL acceptance. Never loads credentials or calls a provider.
// Queries actual accounts only for two established IDs; record reads target fresh fixtures.
import {randomUUID} from 'node:crypto';
export function projectSingleMasterPolicyCheck(){
 const [p1,p2,p3,p4,task,sa,sb]=Array.from({length:7},()=>randomUUID()),projects=[p1,p2,p3,p4],recordIds=[...projects,task],sessionIds=[sa,sb],quoted=values=>values.map(id=>`'${id}'`).join(',');
 const predicate=`id in (${quoted(recordIds)}) or item_type='project_project_link' and (payload->>'parentProjectId' in (${quoted(projects)}) or payload->>'childProjectId' in (${quoted(projects)})) or item_type='project_task_link' and payload->>'taskId'='${task}'`;
 const cleanupSql=`select (select count(*)::int from public.cc_records where ${predicate}) as remaining_qa_records,(select count(*)::int from auth.sessions where id in (${quoted(sessionIds)})) as remaining_qa_sessions;`;
 return{records:10,sessions:2,rollbackOnly:true,recordIds,projectIds:projects,taskId:task,sessionIds,cleanupSql,sql:`begin;
set local statement_timeout='20s';set local lock_timeout='3s';
do $$ declare a uuid;b uuid;r jsonb;first_link jsonb;second_link jsonb;task_before jsonb;links_before jsonb;amount integer;begin
 if exists(select 1 from public.cc_records where ${predicate}) or exists(select 1 from auth.sessions where id in (${quoted(sessionIds)})) then raise exception 'Fresh fictional QA identity collision';end if;
 select id into a from auth.users order by id limit 1;select id into b from auth.users order by id offset 1 limit 1;
 if a is null or b is null or a=b then raise exception 'Two established development QA identities required';end if;
 begin
 insert into auth.sessions(id,user_id) values('${sa}',a),('${sb}',b);
 insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values
 ('${p1}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional master QA A","description":"Fictional only","status":"Active","separateRecurring":false}'),
 ('${p2}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional master QA B","description":"Fictional only","status":"Planned"}'),
 ('${p3}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional smaller QA project","description":"Fictional only","status":"On hold"}'),
 ('${p4}',a,'private','Home','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional grandchild QA project","description":"Fictional only","status":"Planned"}');
 insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values('${task}',a,'private','Home','task','{"fictional":true,"title":"Fictional preserved master QA task","done":false,"description":"Fictional only","subtasks":[]}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${sa}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 if public.cc_project_hierarchy_single_master_ready() is distinct from true then raise exception 'Single-master guards are not ready';end if;
 r:=public.cc_set_task_project_link('${task}',1,'${p1}',1,0,true);
 r:=public.cc_set_task_project_link('${task}',2,'${p4}',1,0,true);
 select to_jsonb(q) into task_before from public.cc_records q where id='${task}';
 select jsonb_agg(to_jsonb(q) order by id) into links_before from public.cc_records q where item_type='project_task_link' and payload->>'taskId'='${task}';
 r:=public.cc_set_project_hierarchy_link('${p1}',1,'${p3}',1,0,true);first_link:=r->'linkRecord';
 if r->>'parentVersion'<>'2' or r->>'childVersion'<>'2' then raise exception 'Hierarchy revisions not advanced';end if;
 r:=public.cc_set_project_hierarchy_link('${p3}',2,'${p4}',1,0,true);
 begin perform public.cc_set_project_hierarchy_link('${p2}',1,'${p3}',3,0,true);raise exception using errcode='P9999',message='Second master accepted';exception when sqlstate 'P0001' then if sqlerrm not like '%only one master%' then raise;end if;end;
 begin insert into public.cc_records(owner_id,visibility,section,item_type,origin,payload) values(a,'private','Personal Life','project_project_link','PRIVATE_COOKIE_PROJECT_PROJECT_LINK',jsonb_build_object('fictional',true,'schemaVersion',1,'parentProjectId','${p2}','childProjectId','${p3}'));raise exception using errcode='P9999',message='Direct second master accepted';exception when sqlstate 'P0001' then if sqlerrm not like '%only one master%' then raise;end if;end;
 if (select count(*) from public.cc_records where item_type='project_project_link' and deleted_at is null and payload->>'childProjectId'='${p3}')<>1 then raise exception 'Single-master identity changed';end if;
 begin perform public.cc_set_project_hierarchy_link('${p4}',2,'${p1}',2,0,true);raise exception using errcode='P9999',message='Cycle accepted';exception when sqlstate 'P0001' then if sqlerrm not like '%cycle%' then raise;end if;end;
 begin perform public.cc_set_project_hierarchy_link('${p1}',2,'${p1}',2,0,true);raise exception using errcode='P9999',message='Self-link accepted';exception when sqlstate 'P0001' then null;end;
 begin perform public.cc_set_project_hierarchy_link('${p1}',1,'${p3}',1,0,true);raise exception using errcode='P9999',message='Stale review accepted';exception when sqlstate 'P0001' then if sqlerrm not like '%changed%' then raise;end if;end;
 with recursive descendants(id) as (select '${p1}'::uuid union select (q.payload->>'childProjectId')::uuid from public.cc_records q join descendants d on q.payload->>'parentProjectId'=d.id::text where q.item_type='project_project_link' and q.deleted_at is null and q.payload->>'parentProjectId' in (${quoted(projects)}))
 select count(distinct q.payload->>'taskId') into amount from public.cc_records q join descendants d on q.payload->>'projectId'=d.id::text where q.item_type='project_task_link' and q.deleted_at is null and q.payload->>'taskId'='${task}';
 if amount<>1 then raise exception 'Shared task identity duplicated in rollup';end if;
 r:=public.cc_set_project_hierarchy_link('${p1}',2,'${p3}',3,1,false);
 r:=public.cc_set_project_hierarchy_link('${p2}',1,'${p3}',4,0,true);second_link:=r->'linkRecord';
 begin perform public.cc_set_project_hierarchy_link('${p1}',3,'${p3}',5,2,true);raise exception using errcode='P9999',message='Former master restored alongside active master';exception when sqlstate 'P0001' then if sqlerrm not like '%only one master%' then raise;end if;end;
 begin update public.cc_records set deleted_at=statement_timestamp() where id='${p2}';raise exception using errcode='P9999',message='Linked parent removal accepted';exception when sqlstate 'P0001' then if sqlerrm not like '%Unlink%' then raise;end if;end;
 begin update public.cc_records set deleted_at=statement_timestamp() where id='${p3}';raise exception using errcode='P9999',message='Linked child removal accepted';exception when sqlstate 'P0001' then if sqlerrm not like '%Unlink%' then raise;end if;end;
 r:=public.cc_set_project_hierarchy_link('${p2}',2,'${p3}',5,1,false);
 r:=public.cc_set_project_hierarchy_link('${p1}',3,'${p3}',6,2,true);
 if r->'linkRecord'->>'id'<>first_link->>'id' or r->'linkRecord'->>'version'<>'3' then raise exception 'Canonical former-master identity changed';end if;
 if not exists(select 1 from public.cc_records where id=(second_link->>'id')::uuid and deleted_at is not null) then raise exception 'Former master history lost';end if;
 if (select to_jsonb(q) from public.cc_records q where id='${task}') is distinct from task_before or (select jsonb_agg(to_jsonb(q) order by id) from public.cc_records q where item_type='project_task_link' and payload->>'taskId'='${task}') is distinct from links_before then raise exception 'Hierarchy changed task or direct membership';end if;
 if (select payload->>'status' from public.cc_records where id='${p1}')<>'Active' or (select payload->>'status' from public.cc_records where id='${p2}')<>'Planned' or (select payload->>'status' from public.cc_records where id='${p3}')<>'On hold' or (select payload->>'status' from public.cc_records where id='${p4}')<>'Planned' then raise exception 'Project status changed automatically';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id','${sb}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.cc_records where ${predicate}) then raise exception 'Other account can read QA structure';end if;
 begin perform public.cc_set_project_hierarchy_link('${p1}',4,'${p3}',7,3,false);raise exception using errcode='P9999',message='Other account changed structure';exception when sqlstate 'P0001' then null;end;
 update public.cc_records set deleted_at=statement_timestamp() where id='${p3}';get diagnostics amount=row_count;if amount<>0 then raise exception 'Other account directly changed QA project';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',gen_random_uuid(),'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
 if public.cc_project_hierarchy_single_master_ready() is distinct from false then raise exception 'Missing session readiness accepted';end if;
 if exists(select 1 from public.cc_records where ${predicate}) then raise exception 'Missing session can read QA records';end if;
 begin perform public.cc_set_project_hierarchy_link('${p1}',4,'${p3}',7,3,false);raise exception using errcode='P9999',message='Missing session changed structure';exception when sqlstate 'P0001' then null;end;
 execute 'reset role';
 if (select count(*) from public.cc_records where ${predicate})<>10 then raise exception 'Unexpected fictional QA footprint';end if;
 raise exception using errcode='P7777',message='ROLLBACK_SINGLE_MASTER_QA_SUCCESS';
 exception when sqlstate 'P7777' then null;end;
 if exists(select 1 from public.cc_records where ${predicate}) or exists(select 1 from auth.sessions where id in (${quoted(sessionIds)})) then raise exception 'Fictional QA subtransaction did not roll back';end if;
end $$;
rollback;
select 'passed' as single_master_checks,10 as fictional_record_bound,2 as temporary_session_bound,
 not exists(select 1 from public.cc_records where ${predicate}) as no_qa_records_saved,
 not exists(select 1 from auth.sessions where id in (${quoted(sessionIds)})) as no_qa_sessions_saved;`};
}
