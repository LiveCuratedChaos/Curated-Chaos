begin;

create index cc_work_project_note_ids on public.cc_records using gin ((payload->'noteIds'))
where item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and payload ? 'noteIds';

create function cc_private.check_work_project_notes() returns trigger
language plpgsql security invoker set search_path='' as $$
declare raw jsonb; previous_id text; value text;
begin
 if not (new.payload ? 'noteIds') then return new; end if;
 if new.item_type <> 'project' or new.origin <> 'PRIVATE_COOKIE_PROJECT' or new.section <> 'Work'
    or new.visibility <> 'private' or new.household_id is not null or new.payload->'fictional' is distinct from 'true'::jsonb
    or new.payload->'schemaVersion' is distinct from '1'::jsonb or jsonb_typeof(new.payload->'noteIds') <> 'array'
 then raise exception 'Private Work project required'; end if;
 if tg_op='UPDATE' and new.payload->'noteIds'=old.payload->'noteIds' and new.owner_id=old.owner_id and new.deleted_at is not distinct from old.deleted_at then return new; end if;
 if jsonb_array_length(new.payload->'noteIds') not between 1 and 2000 then raise exception 'Invalid note collection'; end if;
 for raw in select * from jsonb_array_elements(new.payload->'noteIds') loop
  value:=raw#>>'{}';
  if jsonb_typeof(raw)<>'string' or value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (previous_id is not null and previous_id collate "C" >= value collate "C") then raise exception 'Invalid note reference'; end if;
  perform 1 from public.cc_records n where n.id=value::uuid and n.owner_id=new.owner_id and n.visibility='private'
   and n.household_id is null and n.item_type='note' and n.section='Personal Life' and n.deleted_at is null
   and n.payload->'fictional'='true'::jsonb and jsonb_typeof(n.payload->'title')='string' and length(btrim(n.payload->>'title'))>0 and jsonb_typeof(n.payload->'body')='string' for share;
  if not found then raise exception 'Original private note required'; end if;
  previous_id:=value;
 end loop;
 return new;
end $$;
create trigger cc_check_work_project_notes before insert or update on public.cc_records
 for each row execute function cc_private.check_work_project_notes();

create function cc_private.detach_unavailable_project_note() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.item_type='note' and old.deleted_at is null and (tg_op='DELETE' or new.deleted_at is not null or
  new.owner_id<>old.owner_id or new.item_type<>old.item_type or new.section<>old.section or new.visibility<>old.visibility
  or new.household_id is distinct from old.household_id or new.payload->'fictional' is distinct from 'true'::jsonb or jsonb_typeof(new.payload->'body') is distinct from 'string'
  or jsonb_typeof(new.payload->'title') is distinct from 'string' or length(btrim(new.payload->>'title'))=0) then
  update public.cc_records set payload=case when jsonb_array_length(payload->'noteIds')=1 then payload-'noteIds'
    else jsonb_set(payload,'{noteIds}',(payload->'noteIds')-old.id::text) end
   where owner_id=old.owner_id and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and (payload->'noteIds') ? old.id::text;
 end if;
 return null;
end $$;
create trigger cc_detach_unavailable_project_note after update or delete on public.cc_records
 for each row execute function cc_private.detach_unavailable_project_note();

create function public.cc_set_work_project_note(p_project uuid,p_project_version integer,p_note uuid,p_note_version integer,p_linked boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare who uuid:=auth.uid(); project public.cc_records%rowtype; ids jsonb; next_ids jsonb;
begin
 if who is null or not cc_private.development_session_active() or p_linked is null or p_note_version is null or p_project_version is null
 then raise exception 'Current reviewed private session required'; end if;
 perform 1 from public.cc_records where id=p_note and owner_id=who and visibility='private' and household_id is null
  and section='Personal Life' and item_type='note' and deleted_at is null and version=p_note_version and payload->'fictional'='true'::jsonb for share;
 if not found then raise exception 'Private note changed'; end if;
 select * into project from public.cc_records where id=p_project and version=p_project_version and owner_id=who and section='Work'
  and item_type='project' and origin='PRIVATE_COOKIE_PROJECT' and deleted_at is null and visibility='private' and household_id is null
  and payload->'fictional'='true'::jsonb and payload->'schemaVersion'='1'::jsonb for update;
 if not found then raise exception 'Work project changed'; end if;
 ids:=coalesce(project.payload->'noteIds','[]'::jsonb);
 if (ids ? p_note::text)=p_linked then raise exception 'Project note selection changed'; end if;
 if p_linked then select jsonb_agg(value order by value collate "C") into next_ids from jsonb_array_elements_text(ids||to_jsonb(p_note::text)) value;
 else next_ids:=ids-p_note::text; end if;
 update public.cc_records set payload=case when next_ids='[]'::jsonb then payload-'noteIds' else jsonb_set(payload,'{noteIds}',next_ids) end
  where id=project.id and owner_id=who returning * into project;
 return to_jsonb(project);
end $$;
revoke all on function cc_private.check_work_project_notes(),cc_private.detach_unavailable_project_note() from public,anon,authenticated;
revoke all on function public.cc_set_work_project_note(uuid,integer,uuid,integer,boolean) from public,anon;
grant execute on function public.cc_set_work_project_note(uuid,integer,uuid,integer,boolean) to authenticated;
commit;
