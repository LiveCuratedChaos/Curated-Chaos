// Trusted SQL acceptance using the same existing development identities as prior
// project QA. No credentials, real record reads, account creation or usable tokens.
import {randomUUID} from 'node:crypto';
export function projectHierarchyPolicyCheck(){
 const [p1,p2,p3,p4,task,sa,sb]=Array.from({length:7},()=>randomUUID()),projects=[p1,p2,p3,p4],quoted=values=>values.map(v=>`'${v}'`).join(','),projectIds=quoted(projects),recordIds=quoted([...projects,task]),sessionIds=quoted([sa,sb]);
 const recordPredicate=`id in (${recordIds}) or item_type='project_project_link' and payload->>'parentProjectId' in (${projectIds}) or item_type='project_task_link' and payload->>'taskId'='${task}'`;
 return{records:10,sessions:2,rollbackOnly:true,recordIds:[...projects,task],sessionIds:[sa,sb],sql:`begin;
set local statement_timeout='20s';set local lock_timeout='3s';
do $$ declare a uuid;b uuid;r jsonb;l jsonb;first_link jsonb;task_before jsonb;links_before jsonb;v integer;amount integer;begin
 if exists(select 1 from public.cc_records where ${recordPredicate}) or exists(select 1 from auth.sessions where id in (${sessionIds})) then raise exception 'Fresh fictional QA identity collision';end if;
 select id into a from auth.users order by id limit 1;select id into b from auth.users order by id offset 1 limit 1;
 if a is null or b is null or a=b then raise exception 'Two established development QA identities required';end if;
 -- Roll back the entire nested block even on success. An unexpected assertion
 -- aborts the outer transaction as well; no error is converted into a pass.
 begin
 insert into auth.sessions(id,user_id) values('${sa}',a),('${sb}',b);
 insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values
 ('${p1}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional hierarchy QA A","description":"","status":"Active","separateRecurring":false}'),
 ('${p2}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional hierarchy QA B","description":"","status":"Active"}'),
 ('${p3}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional hierarchy QA C","description":"","status":"Active"}'),
 ('${p4}',a,'private','Home','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional hierarchy QA D","description":"","status":"Planned"}');
 insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values('${task}',a,'private','Home','task','{"fictional":true,"title":"Fictional preserved hierarchy QA task","done":false,"description":"Fictional only","subtasks":[]}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${sa}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 r:=public.cc_set_task_project_link('${task}',1,'${p1}',1,0,true);
 r:=public.cc_set_task_project_link('${task}',2,'${p4}',1,0,true);
 select to_jsonb(q) into task_before from public.cc_records q where id='${task}';
 select jsonb_agg(to_jsonb(q) order by id) into links_before from public.cc_records q where item_type='project_task_link' and payload->>'taskId'='${task}';
 r:=public.cc_set_project_hierarchy_link('${p1}',1,'${p3}',1,0,true);first_link:=r->'linkRecord';
 if r->>'parentVersion'<>'2' or r->>'childVersion'<>'2' then raise exception 'Hierarchy revisions not advanced';end if;
 r:=public.cc_set_project_hierarchy_link('${p2}',1,'${p3}',2,0,true);
 r:=public.cc_set_project_hierarchy_link('${p3}',3,'${p4}',1,0,true);
 if (select count(*) from public.cc_records where item_type='project_project_link' and payload->>'childProjectId'='${p3}' and deleted_at is null)<>2 then raise exception 'Several-parent relationship failed';end if;
 begin perform public.cc_set_project_hierarchy_link('${p4}',2,'${p1}',2,0,true);raise exception using errcode='P9999',message='Cycle accepted';exception when sqlstate 'P0001' then null;end;
 begin perform public.cc_set_project_hierarchy_link('${p1}',2,'${p1}',2,0,true);raise exception using errcode='P9999',message='Self-link accepted';exception when sqlstate 'P0001' then null;end;
 begin perform public.cc_set_project_hierarchy_link('${p1}',1,'${p3}',1,0,true);raise exception using errcode='P9999',message='Stale review accepted';exception when sqlstate 'P0001' then null;end;
 begin update public.cc_records set deleted_at=statement_timestamp() where id='${p3}';raise exception using errcode='P9999',message='Linked target removal accepted';exception when sqlstate 'P0001' then null;end;
 with recursive descendants(id) as (select '${p1}'::uuid union select (q.payload->>'childProjectId')::uuid from public.cc_records q join descendants d on q.payload->>'parentProjectId'=d.id::text where q.item_type='project_project_link' and q.deleted_at is null and q.payload->>'parentProjectId' in (${projectIds}))
 select count(distinct q.payload->>'taskId') into amount from public.cc_records q join descendants d on q.payload->>'projectId'=d.id::text where q.item_type='project_task_link' and q.deleted_at is null and q.payload->>'taskId'='${task}';
 if amount<>1 then raise exception 'Shared task identity duplicated in rollup';end if;
 r:=public.cc_set_project_hierarchy_link('${p1}',2,'${p3}',4,1,false);l:=r->'linkRecord';
 r:=public.cc_set_project_hierarchy_link('${p1}',3,'${p3}',5,2,true);
 if r->'linkRecord'->>'id'<>first_link->>'id' or r->'linkRecord'->>'version'<>'3' then raise exception 'Canonical relink identity changed';end if;
 if (select to_jsonb(q) from public.cc_records q where id='${task}') is distinct from task_before or (select jsonb_agg(to_jsonb(q) order by id) from public.cc_records q where item_type='project_task_link' and payload->>'taskId'='${task}') is distinct from links_before then raise exception 'Hierarchy changed task or direct membership';end if;
 if not exists(select 1 from public.cc_records where id='${p4}' and payload->>'status'='Planned') then raise exception 'Project status changed automatically';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id','${sb}','role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.cc_records where ${recordPredicate}) then raise exception 'Other account can read QA structure';end if;
 begin perform public.cc_set_project_hierarchy_link('${p1}',4,'${p3}',6,3,false);raise exception using errcode='P9999',message='Other account changed structure';exception when sqlstate 'P0001' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',gen_random_uuid(),'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.cc_records where id='${task}') then raise exception 'Missing session can read QA task';end if;
 begin perform public.cc_project_hierarchy_snapshot();raise exception using errcode='P9999',message='Missing session can read hierarchy snapshot';exception when sqlstate 'P0001' then null;end;
 execute 'reset role';
 if (select count(*) from public.cc_records where ${recordPredicate})<>10 then raise exception 'Unexpected fictional QA footprint';end if;
 raise exception using errcode='P7777',message='ROLLBACK_FICTIONAL_QA_SUCCESS';
 exception when sqlstate 'P7777' then null;end;
 if exists(select 1 from public.cc_records where ${recordPredicate}) or exists(select 1 from auth.sessions where id in (${sessionIds})) then raise exception 'Fictional QA subtransaction did not roll back';end if;
end $$;
rollback;
select 'passed' as hierarchy_checks,10 as fictional_record_bound,2 as temporary_session_bound,
 not exists(select 1 from public.cc_records where ${recordPredicate}) as no_qa_records_saved,
 not exists(select 1 from auth.sessions where id in (${sessionIds})) as no_qa_sessions_saved;`};
}
