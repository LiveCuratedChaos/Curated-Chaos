-- OFFLINE PREPARATION ONLY. Non-persistent private input view, not a public RPC.
-- Restore links only when every affected task source is new in this transaction.
begin;
create view cc_private.restore_new_task_graph with(security_invoker=true,security_barrier=true) as select null::jsonb as payload where false;
create function cc_private.restore_new_task_graph() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid();records jsonb;value jsonb;r public.cc_records%rowtype;ids uuid[]:='{}';sources uuid[]:='{}';result jsonb:='[]';source_id uuid;
begin
 if actor is null or not cc_private.development_session_active() or public.cc_private_common_task_links_ready() is not true then raise exception 'Verified private graph recovery context required';end if;
 if jsonb_typeof(new.payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(new.payload))<>1 or not(new.payload?'records') or jsonb_typeof(new.payload->'records') is distinct from 'array' then raise exception 'Exact reviewed recovery graph required';end if;
 records:=new.payload->'records';if jsonb_array_length(records)>2000 or octet_length(convert_to(new.payload::text,'UTF8'))>6291456 then raise exception 'Recovery graph exceeds its reviewed bound';end if;
 perform cc_private.school_lock(actor);
 lock table public.cc_records in share row exclusive mode nowait;
 for value in select v from jsonb_array_elements(records) v loop
 if jsonb_typeof(value) is distinct from 'object' or (select count(*) from jsonb_object_keys(value))<>12 or not(value?&array['id','owner_id','household_id','visibility','section','item_type','origin','payload','version','deleted_at','created_at','updated_at']) then raise exception 'Complete preserved recovery metadata required';end if;
 r:=jsonb_populate_record(null::public.cc_records,value);
 if r.id is null or value->>'id' is distinct from r.id::text or r.id=any(ids) or r.owner_id is distinct from actor
 or r.visibility is distinct from 'private' or r.household_id is not null or r.deleted_at is not null
 or r.version is null or r.version<1 or r.created_at is null or r.updated_at is null or not isfinite(r.created_at) or not isfinite(r.updated_at)
 or r.section not in ('Home','Calendar','Personal Life','Work','School','Finances') or r.origin is null or length(r.origin) not between 1 and 500
 or r.item_type not in ('note','task','project','school_fixture','project_task_link','common_task_link') or jsonb_typeof(r.payload) is distinct from 'object' or r.payload->'fictional' is distinct from 'true'::jsonb then raise exception 'Supported new owned private source required';end if;
 ids:=array_append(ids,r.id);if r.item_type not in ('project_task_link','common_task_link') then sources:=array_append(sources,r.id);end if;
 end loop;
 if exists(select 1 from public.cc_records where id=any(ids)) then raise exception 'Recovery graph cannot overwrite existing identities';end if;
 -- Both membership families normally advance their task source. Only fresh,
 -- invisible-to-other-sessions sources may enter this nested insertion context.
 for value in select v from jsonb_array_elements(records) v where v->>'item_type' in ('project_task_link','common_task_link') loop
 if value->>'item_type'='project_task_link' then source_id:=(value->'payload'->>'taskId')::uuid;
 else source_id:=(value->'payload'->'task'->>'recordId')::uuid;end if;
 if source_id is null or not(source_id=any(sources)) then raise exception 'Existing task sources require a separate reviewed reconciliation';end if;
 end loop;
 -- Separate INSERT statements make dependency order explicit to all invoker guards.
 for value in select v from jsonb_array_elements(records) with ordinality q(v,n)
 order by case when v->>'item_type'='school_fixture' and v->'payload'->>'kind'='degree' then 0 when v->>'item_type'='school_fixture' then 1 when v->>'item_type' in ('project_task_link','common_task_link') then 3 else 2 end,n loop
 r:=jsonb_populate_record(null::public.cc_records,value);
 insert into public.cc_records select (r).*;
 end loop;
 for r in select * from public.cc_records where id=any(ids) and owner_id=actor and visibility='private' and household_id is null order by id loop result:=result||jsonb_build_array(to_jsonb(r));end loop;
 if jsonb_array_length(result)<>jsonb_array_length(records) then raise exception 'Restored graph acknowledgement is incomplete';end if;
 new.payload:=jsonb_build_object('records',result);return new;
end$$;
create trigger cc_restore_new_task_graph instead of insert on cc_private.restore_new_task_graph for each row execute function cc_private.restore_new_task_graph();
revoke all on cc_private.restore_new_task_graph from public,anon,authenticated;
grant select,insert on cc_private.restore_new_task_graph to authenticated;
revoke all on function cc_private.restore_new_task_graph() from public,anon,authenticated;
commit;
