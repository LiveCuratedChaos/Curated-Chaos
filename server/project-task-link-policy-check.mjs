// Two existing development identities; fictional records/sessions, entire transaction rolled back.
import {randomUUID} from 'node:crypto';
export function projectTaskLinkPolicyCheck(){const ids=Array.from({length:7},()=>randomUUID()),[task,p1,p2,next,sa,sb,op]=ids;return{records:8,sessions:2,rollbackOnly:true,sql:`begin;
set local statement_timeout='20s';set local lock_timeout='3s';
do $$ declare a uuid;b uuid;t jsonb;r jsonb;replay jsonb;l jsonb;v integer;n integer;before_task jsonb;before_links jsonb;today date:=(timezone('America/New_York',statement_timestamp()))::date;begin
 select id into a from auth.users order by id limit 1;select id into b from auth.users order by id offset 1 limit 1;if a is null or b is null then raise exception 'Two existing development users required';end if;
 insert into auth.sessions(id,user_id) values('${sa}',a),('${sb}',b);
 insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values('${task}',a,'private','Home','task',jsonb_build_object('fictional',true,'title','Fictional link QA chore','done',false,'day',today::text,'description','Fictional preserved details','subtasks','[]'::jsonb));
 insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values('${p1}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional project one","description":"","status":"Active"}'),('${p2}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT','{"fictional":true,"schemaVersion":1,"title":"Fictional project two","description":"","status":"Active"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${sa}')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 select payload into t from public.cc_records where id='${task}';
 r:=public.cc_set_task_project_link('${task}',1,'${p1}',1,0,true);l:=r->'linkRecord';
 if (r->>'taskVersion')::integer<>2 or (select payload from public.cc_records where id='${task}')<>t then raise exception 'Link changed task contents';end if;
 begin perform public.cc_set_task_project_link('${task}',1,'${p1}',1,0,true);raise exception using errcode='P9999',message='Duplicate approval accepted';exception when sqlstate 'P0001' then null;end;
 r:=public.cc_set_task_project_link('${task}',2,'${p2}',1,0,true);
 if (select count(*) from public.cc_records where owner_id=a and item_type='project_task_link' and payload->>'taskId'='${task}' and deleted_at is null)<>2 then raise exception 'Multiple project membership failed';end if;
 r:=public.cc_complete_recurring_chore('${task}',3,jsonb_build_object('anchorDay',today::text,'frequency','daily','interval',1),today+1,today,'${op}','${next}');
 if r->>'projectLinkCount'<>'2' or r->'nextRecord'->>'version'<>'3' or r->'nextRecord'->'payload'->>'description'<>'Fictional preserved details' then raise exception 'Project inheritance failed';end if;
 replay:=public.cc_complete_recurring_chore('${task}',3,jsonb_build_object('anchorDay',today::text,'frequency','daily','interval',1),today+1,today,'${op}','${next}');if replay->'alreadySaved'<>'true'::jsonb then raise exception 'Exact replay failed';end if;
 update public.cc_records set payload=payload||'{"done":false,"status":"Not Started"}'::jsonb where id='${task}';
 if (select count(*) from public.cc_records where owner_id=a and item_type='project_task_link' and payload->>'taskId'='${next}' and deleted_at is null)<>2 then raise exception 'Reopen changed successor membership';end if;
 update public.cc_records set deleted_at=statement_timestamp() where id='${next}';update public.cc_records set deleted_at=null where id='${next}';
 if exists(select 1 from public.cc_records where owner_id=a and item_type='project_task_link' and payload->>'taskId'='${next}' and deleted_at is null) then raise exception 'Task restore silently relinked projects';end if;
 select to_jsonb(qa_row) into before_task from public.cc_records qa_row where id='${task}';
 select jsonb_agg(to_jsonb(qa_row) order by qa_row.id) into before_links from public.cc_records qa_row where item_type='project_task_link' and payload->>'taskId' in ('${task}','${next}');
 update public.cc_records set payload=payload||'{"separateRecurring":false}'::jsonb where id='${p1}' and version=1;
 if not exists(select 1 from public.cc_records where id='${p1}' and version=2 and payload->'separateRecurring'='false'::jsonb and payload->>'status'='Active') then raise exception 'Included recurring progress option failed';end if;
 update public.cc_records set payload=payload||'{"separateRecurring":true}'::jsonb where id='${p1}' and version=2;
 if not exists(select 1 from public.cc_records where id='${p1}' and version=3 and payload->'separateRecurring'='true'::jsonb and payload->>'status'='Active') then raise exception 'Separate recurring progress option failed';end if;
 if (select to_jsonb(qa_row) from public.cc_records qa_row where id='${task}') is distinct from before_task or (select jsonb_agg(to_jsonb(qa_row) order by qa_row.id) from public.cc_records qa_row where item_type='project_task_link' and payload->>'taskId' in ('${task}','${next}')) is distinct from before_links then raise exception 'Progress option changed task or memberships';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id','${sb}')::text,true);perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.cc_records where id in ('${task}','${p1}','${p2}','${next}') or item_type='project_task_link' and payload->>'taskId' in ('${task}','${next}')) then raise exception 'Other account can read QA links';end if;
 begin perform public.cc_set_task_project_link('${task}',5,'${p1}',1,1,false);raise exception using errcode='P9999',message='Other account can unlink task';exception when sqlstate 'P0001' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',gen_random_uuid())::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.cc_records where id='${task}') then raise exception 'Missing session can read task';end if;
 begin perform public.cc_set_task_project_link('${task}',5,'${p1}',1,1,false);raise exception using errcode='P9999',message='Missing session can unlink task';exception when sqlstate 'P0001' then null;end;
 execute 'reset role';end $$;
rollback;
select 'passed' as project_link_checks,not exists(select 1 from public.cc_records where id in ('${task}','${p1}','${p2}','${next}') or item_type='project_task_link' and payload->>'taskId' in ('${task}','${next}')) as no_qa_records_saved,not exists(select 1 from auth.sessions where id in ('${sa}','${sb}')) as no_qa_sessions_saved;`};}
