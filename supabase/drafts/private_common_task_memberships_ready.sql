-- Generated exact source/catalog binding. No record data, secrets or automatic installation.
create function public.cc_private_common_task_links_ready() returns boolean language sql stable security invoker set search_path='' as $$
select coalesce(public.cc_private_school_recovery_ready(),false)
 and not exists(select 1 from(values ('cc_private.common_task_reference_key(jsonb,boolean)','855e2922dfc15a31aa6aa80f2013dd1c',true,'text','i','plpgsql',array['p_reference','p_task']::text[],0,null,false),
('cc_private.common_task_membership_key(jsonb,jsonb)','d536d955da7709d1f611fa6fb9b45a7c',true,'text','i','plpgsql',array['p_task','p_project']::text[],0,null,false),
('cc_private.common_task_trim(text)','8176cfe8f78c9b7ee521928aa6a367c3',true,'text','i','sql',array['v']::text[],0,null,false),
('cc_private.common_task_endpoint_matches(public.cc_records,uuid,jsonb,boolean,boolean)','85cd90973a793851d27624faed34e5f9',true,'boolean','s','plpgsql',array['p_row','p_owner','p_reference','p_task','p_history']::text[],1,'false',false),
('cc_private.common_task_intrinsic(public.cc_records,jsonb,jsonb)','a4b39eb22046816ce1b0cec943003f4a',true,'boolean','i','sql',array['p_task_row','p_task','p_project']::text[],0,null,false),
('cc_private.common_task_membership_matches(public.cc_records,public.cc_records,uuid,jsonb,boolean)','6ac8376889abf409e29e7a384475a805',true,'boolean','s','plpgsql',array['p_task_row','p_project_row','p_owner','p_payload','p_history']::text[],1,'false',false),
('cc_private.common_task_link_guard()','7c97241d8ed04a429b786732cad103fd',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_touch_source()','d7b096fc56434fcb1d986e145f8881be',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_manual_limit()','c2234e580386c287c4b27b3b2edcc69b',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_protect_sources()','13a0945030d6836a67ba32e312c76c49',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.common_task_recurring_carry_guard()','aa5b6bfaa780a3aba53fd8086414e1cd',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('public.cc_set_common_task_link(jsonb,integer,jsonb,integer,integer,boolean)','3eebe314e57c5001777abe5206fa3d40',true,'jsonb','v','plpgsql',array['p_task','p_task_version','p_project','p_project_version','p_link_version','p_linked']::text[],0,null,false),
('public.cc_complete_common_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid)','8732f679655e4300ebba97a6b642a6c7',true,'jsonb','v','plpgsql',array['p_record_id','p_version','p_schedule','p_next_day','p_review_day','p_operation_id','p_successor_id']::text[],0,null,false),
('public.cc_private_school_recovery_ready()','5ccdd01d242af0faaaf47502ce3b9bb3',true,'boolean','s','sql',array[]::text[],0,null,false),
('cc_private.validate_project_task_link()','f040a387f1dd3b53851a0474842bcadf',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.touch_linked_task()','f7b935c39f53f9da91c38ba32dbc86d6',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('cc_private.protect_link_targets()','1d3f12202ff11f58bc9e3c2ba6a622ef',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('public.cc_set_task_project_link(uuid,integer,uuid,integer,integer,boolean)','b250e12d738d29559438e29ea7eac2a4',true,'jsonb','v','plpgsql',array['p_task_id','p_task_version','p_project_id','p_project_version','p_link_version','p_linked']::text[],0,null,false),
('public.cc_complete_recurring_chore(uuid,integer,jsonb,date,date,uuid,uuid)','cc3830f8d2238be528b4ac551f6b37d1',true,'jsonb','v','plpgsql',array['p_record_id','p_version','p_schedule','p_next_day','p_review_day','p_operation_id','p_successor_id']::text[],0,null,false),
('cc_private.recurring_chore_day(date,text,integer,integer)','2df1bfe850ef468c5dca73c292566a6e',true,'date','i','plpgsql',array['anchor','frequency','every_n','ordinal']::text[],0,null,false),
('cc_private.recurring_chore_plan(jsonb,date,date)','0600fbb44d4546c79124f811ab1339e4',true,'jsonb','i','plpgsql',array['schedule','due_day','completed_on']::text[],0,null,false),
('cc_private.restore_new_task_graph()','c2a1937dc61d727a46406953ce18fa5c',false,'trigger','v','plpgsql',array[]::text[],0,null,false),
('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)','01d21a3de25ea375cb983b1eb152a5db',true,'jsonb','v','plpgsql',array['p_parent_project_id','p_parent_version','p_child_project_id','p_child_version','p_link_version','p_linked']::text[],0,null,true)) expected(signature,body_hash,authenticated_execute,result_type,volatility,language,arg_names,default_count,defaults,optional)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
 where (p.oid is null and not expected.optional) or (p.oid is not null and (pg_catalog.md5(p.prosrc)<>expected.body_hash or p.prosecdef or p.prokind<>'f'
 or p.proconfig is distinct from array['search_path=""']::text[]
 or p.prorettype<>pg_catalog.to_regtype(expected.result_type) or p.provolatile::text<>expected.volatility
 or p.prolang<>(select oid from pg_catalog.pg_language where lanname=expected.language)
 or coalesce(p.proargnames,array[]::text[]) is distinct from expected.arg_names
 or p.pronargdefaults<>expected.default_count or pg_catalog.pg_get_expr(p.proargdefaults,0) is distinct from expected.defaults
 or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from expected.authenticated_execute)))
 and(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in('cc_private.common_task_reference_key','cc_private.common_task_membership_key','cc_private.common_task_trim','cc_private.common_task_endpoint_matches','cc_private.common_task_intrinsic','cc_private.common_task_membership_matches','cc_private.common_task_link_guard','cc_private.common_task_touch_source','cc_private.common_task_manual_limit','cc_private.common_task_protect_sources','cc_private.common_task_recurring_carry_guard','public.cc_set_common_task_link','public.cc_complete_common_recurring_chore','public.cc_private_school_recovery_ready','cc_private.validate_project_task_link','cc_private.touch_linked_task','cc_private.protect_link_targets','public.cc_set_task_project_link','public.cc_complete_recurring_chore','cc_private.recurring_chore_day','cc_private.recurring_chore_plan','cc_private.restore_new_task_graph','public.cc_set_project_hierarchy_link'))=22+case when pg_catalog.to_regprocedure('public.cc_set_project_hierarchy_link(uuid,integer,uuid,integer,integer,boolean)') is null then 0 else 1 end
 and not exists(select 1 from(values ('cc_validate_project_task_link','cc_private.validate_project_task_link()',23,false),
('cc_touch_linked_task','cc_private.touch_linked_task()',21,false),
('cc_protect_link_targets','cc_private.protect_link_targets()',19,false),
('cc_common_task_link_guard','cc_private.common_task_link_guard()',31,false),
('cc_common_task_touch_source','cc_private.common_task_touch_source()',21,false),
('cc_common_task_manual_limit','cc_private.common_task_manual_limit()',23,false),
('cc_common_task_protect_sources','cc_private.common_task_protect_sources()',27,false),
('cc_common_task_recurring_carry_guard','cc_private.common_task_recurring_carry_guard()',17,true)) expected(name,signature,type,deferred)
 left join pg_catalog.pg_trigger t on t.tgrelid='public.cc_records'::regclass and t.tgname=expected.name
 where t.oid is null or t.tgisinternal or t.tgenabled<>'O' or t.tgqual is not null or t.tgattr<>''::int2vector or t.tgnargs<>0
 or t.tgtype<>expected.type or t.tgfoid<>pg_catalog.to_regprocedure(expected.signature)
 or t.tgdeferrable is distinct from expected.deferred or t.tginitdeferred is distinct from expected.deferred
 or (t.tgconstraint<>0) is distinct from expected.deferred)
 and exists(select 1 from pg_catalog.pg_class v where v.oid=pg_catalog.to_regclass('cc_private.restore_new_task_graph') and v.relkind='v'
 and 'security_invoker=true'=any(v.reloptions) and 'security_barrier=true'=any(v.reloptions) and cardinality(v.reloptions)=2
 and pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.pg_get_viewdef(v.oid),'[[:space:]]+',' ','g'))='SELECT NULL::jsonb AS payload WHERE false;'
 and(select count(*) from pg_catalog.pg_attribute a where a.attrelid=v.oid and a.attnum>0 and not a.attisdropped)=1
 and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=v.oid and a.attnum=1 and a.attname='payload' and a.atttypid='jsonb'::regtype and not a.attisdropped)
 and(select count(*) from pg_catalog.pg_rewrite r where r.ev_class=v.oid)=1
 and not pg_catalog.has_table_privilege('anon',v.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and pg_catalog.has_table_privilege('authenticated',v.oid,'SELECT') and pg_catalog.has_table_privilege('authenticated',v.oid,'INSERT')
 and not pg_catalog.has_table_privilege('authenticated',v.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 and(select count(*) from pg_catalog.pg_trigger t where t.tgrelid=v.oid and not t.tgisinternal)=1
 and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid=v.oid and t.tgname='cc_restore_new_task_graph' and not t.tgisinternal
 and t.tgenabled='O' and t.tgqual is null and t.tgattr=''::int2vector and t.tgnargs=0 and t.tgtype=69
 and t.tgfoid=pg_catalog.to_regprocedure('cc_private.restore_new_task_graph()') and not t.tgdeferrable and not t.tginitdeferred))
 and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam
 where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_private_task_project') and i.indrelid='public.cc_records'::regclass
 and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and not i.indnullsnotdistinct and i.indnkeyatts=3 and i.indnatts=3 and am.amname='btree'
 and pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='owner_id'
 and pg_catalog.pg_get_expr(i.indexprs,i.indrelid)='(payload ->> ''taskId''::text), (payload ->> ''projectId''::text)'
 and pg_catalog.pg_get_expr(i.indpred,i.indrelid)='(item_type = ''project_task_link''::text)'
 and i.indclass[0]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='uuid_ops' and a.amname='btree')
 and i.indclass[1]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='text_ops' and a.amname='btree')
 and i.indclass[2]=i.indclass[1])
 and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid join pg_catalog.pg_am am on am.oid=c.relam
 where i.indexrelid=pg_catalog.to_regclass('public.cc_unique_common_task_pair') and i.indrelid='public.cc_records'::regclass
 and i.indisunique and i.indisvalid and i.indisready and i.indimmediate and not i.indnullsnotdistinct and i.indnkeyatts=2 and i.indnatts=2 and am.amname='btree'
 and pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='owner_id'
 and pg_catalog.pg_get_expr(i.indexprs,i.indrelid)='cc_private.common_task_membership_key((payload -> ''task''::text), (payload -> ''project''::text))'
 and pg_catalog.pg_get_expr(i.indpred,i.indrelid)='(item_type = ''common_task_link''::text)'
 and i.indclass[0]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='uuid_ops' and a.amname='btree')
 and i.indclass[1]=(select op.oid from pg_catalog.pg_opclass op join pg_catalog.pg_namespace n on n.oid=op.opcnamespace join pg_catalog.pg_am a on a.oid=op.opcmethod where n.nspname='pg_catalog' and op.opcname='text_ops' and a.amname='btree'));
$$;
revoke all on function public.cc_private_common_task_links_ready() from public,anon,authenticated;
grant execute on function public.cc_private_common_task_links_ready() to authenticated;
