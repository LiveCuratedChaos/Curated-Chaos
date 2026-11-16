// Rollback-only development acceptance. No account creation or usable login tokens.
import {randomUUID} from 'node:crypto';
export function privateProjectPolicyCheck(){const id=randomUUID(),sa=randomUUID(),sb=randomUUID();return{records:1,sessions:2,rollbackOnly:true,sql:`begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
do $$ declare a uuid;b uuid;n integer;p jsonb;begin
 select id into a from auth.users order by id limit 1;select id into b from auth.users order by id offset 1 limit 1;
 if a is null or b is null or a=b then raise exception 'Two existing development users required';end if;
 insert into auth.sessions(id,user_id) values('${sa}',a),('${sb}',b);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','${sa}')::text,true);perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 p:='{"fictional":true,"schemaVersion":1,"title":"Fictional private project QA","description":"Fictional exact text","status":"Active"}'::jsonb;
 insert into public.cc_records(id,owner_id,household_id,visibility,section,item_type,origin,payload) values('${id}',a,null,'private','Work','project','PRIVATE_COOKIE_PROJECT',p);
 if not exists(select 1 from public.cc_records where id='${id}' and owner_id=a and version=1 and payload=p) then raise exception 'Project insert/read failed';end if;
 begin insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values('${id}',a,'private','Work','project','PRIVATE_COOKIE_PROJECT',p);raise exception using errcode='P9999',message='Duplicate identity accepted';exception when unique_violation then null;end;
 update public.cc_records set payload=p||'{"status":"On hold"}'::jsonb,section='Home' where id='${id}' and version=1;get diagnostics n=row_count;if n<>1 then raise exception 'Reviewed update failed';end if;
 update public.cc_records set payload=p where id='${id}' and version=1;get diagnostics n=row_count;if n<>0 then raise exception 'Stale update accepted';end if;
 if not exists(select 1 from public.cc_records where id='${id}' and version=2 and section='Home' and payload=p||'{"status":"On hold"}'::jsonb) then raise exception 'Project fields changed unexpectedly';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id','${sb}')::text,true);perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.cc_records where id='${id}') then raise exception 'Other account can read project';end if;
 update public.cc_records set payload=p where id='${id}';get diagnostics n=row_count;if n<>0 then raise exception 'Other account can update project';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',gen_random_uuid())::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.cc_records where id='${id}') then raise exception 'Missing session can read project';end if;
 update public.cc_records set payload=p where id='${id}';get diagnostics n=row_count;if n<>0 then raise exception 'Missing session can update project';end if;
 execute 'reset role';end $$;
rollback;
select 'passed' as project_checks,not exists(select 1 from public.cc_records where id='${id}') as no_qa_records_saved,not exists(select 1 from auth.sessions where id in ('${sa}','${sb}')) as no_qa_sessions_saved;`};}
