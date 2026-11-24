-- Local recovery candidate. Install after the single-master guards in an isolated database.
begin;
create view cc_private.restore_new_project_hierarchy with (security_invoker=true, security_barrier=true)
 as select null::jsonb as records where false;

create function cc_private.restore_new_project_hierarchy() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 actor uuid := auth.uid();
 row_data jsonb;
 r public.cc_records%rowtype;
 project_ids uuid[] := '{}';
 new_ids uuid[] := '{}';
 restored jsonb;
begin
 if actor is null or public.cc_project_hierarchy_single_master_ready() is not true then
  raise exception 'Verified single-master storage required';
 end if;
 if jsonb_typeof(new.records) is distinct from 'array' or jsonb_array_length(new.records) not between 3 and 2000
    or octet_length(convert_to(new.records::text,'UTF8'))>6291456 then
  raise exception 'Bounded new project hierarchy required';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('cc-project-hierarchy:'||actor::text,0));
 lock table public.cc_records in share row exclusive mode nowait;
 for row_data in select value from jsonb_array_elements(new.records) loop
  if jsonb_typeof(row_data) is distinct from 'object' or (select count(*) from jsonb_object_keys(row_data))<>12
     or not(row_data ?& array['id','owner_id','visibility','household_id','origin','section','item_type','payload','version','created_at','updated_at','deleted_at']) then
   raise exception 'Exact archive row required';
  end if;
  r:=jsonb_populate_record(null::public.cc_records,row_data);
  if r.id is null or r.id=any(new_ids) or r.owner_id is distinct from actor or r.household_id is not null
     or r.visibility is distinct from 'private' or r.deleted_at is not null or r.version is null or r.version<1
     or r.created_at is null or r.updated_at is null or not isfinite(r.created_at) or not isfinite(r.updated_at)
     or r.item_type is null or r.item_type not in ('project','project_project_link') then
   raise exception 'New owned project hierarchy required';
  end if;
  new_ids:=array_append(new_ids,r.id);
  if r.item_type='project' then
   if r.origin is distinct from 'PRIVATE_COOKIE_PROJECT' or r.payload->'fictional' is distinct from 'true'::jsonb
      or r.payload->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Canonical private project required'; end if;
   project_ids:=array_append(project_ids,r.id);
  end if;
 end loop;
 if cardinality(project_ids)=cardinality(new_ids) or exists(select from public.cc_records where id=any(new_ids)) then
  raise exception 'Hierarchy recovery requires missing originals and their relationships';
 end if;
 for row_data in select value->'payload' from jsonb_array_elements(new.records) where value->>'item_type'='project_project_link' loop
  if (row_data->>'parentProjectId')::uuid=any(project_ids) is not true
     or (row_data->>'childProjectId')::uuid=any(project_ids) is not true then
   raise exception 'Both projects must be new in this recovery';
  end if;
 end loop;
 -- All selected projects are new. Nested insertion keeps their archived revisions while
 -- the ordinary membership guards still check ownership, the parent slot and cycles.
 for row_data in select value from jsonb_array_elements(new.records) order by value->>'item_type' loop
  r:=jsonb_populate_record(null::public.cc_records,row_data);
  insert into public.cc_records select (r).*;
 end loop;
 select jsonb_agg(to_jsonb(saved) order by saved.id) into restored from public.cc_records saved
  where saved.id=any(new_ids) and saved.owner_id=actor and saved.household_id is null and saved.visibility='private';
 if jsonb_array_length(restored) is distinct from cardinality(new_ids) then raise exception 'Incomplete hierarchy receipt'; end if;
 new.records:=restored;
 return new;
end $$;
create trigger cc_restore_new_project_hierarchy instead of insert on cc_private.restore_new_project_hierarchy
 for each row execute function cc_private.restore_new_project_hierarchy();
revoke all on cc_private.restore_new_project_hierarchy from public,anon,authenticated;
grant select,insert on cc_private.restore_new_project_hierarchy to authenticated;
revoke all on function cc_private.restore_new_project_hierarchy() from public,anon,authenticated;
commit;
