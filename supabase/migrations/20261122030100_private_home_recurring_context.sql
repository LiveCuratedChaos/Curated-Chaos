-- Retain Home metadata on the reviewed successor without replacing the installed
-- completion function or its optional School lock-order wrapper.
begin;
create function cc_private.carry_home_recurring_context()
returns trigger language plpgsql security invoker set search_path='' as $$
declare source_payload jsonb; extension text;
begin
 if new.origin <> 'PRIVATE_RECURRING_CHORE' or new.item_type <> 'task' or
    new.section <> 'Home' or new.visibility <> 'private' or new.household_id is not null or
    new.deleted_at is not null or new.payload->'fictional' is distinct from 'true'::jsonb then
  return new;
 end if;
 select source.payload into source_payload from public.cc_records source
  where source.owner_id = new.owner_id and source.id::text = new.payload->>'recurrence_predecessor'
    and source.section = 'Home' and source.item_type = 'task' and source.visibility = 'private'
    and source.household_id is null and source.deleted_at is null and source.payload->'done' = 'true'::jsonb
    and source.payload->'recurrence_completion'->>'successorId' = new.id::text
    and source.payload->'recurrence_completion'->>'nextDay' = new.payload->>'day';
 if found then
  foreach extension in array array['homeCleaning','homeGrocery','homeDelivery'] loop
   if source_payload ? extension and not (new.payload ? extension) then
    new.payload := jsonb_set(new.payload,array[extension],source_payload->extension);
   end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function cc_private.carry_home_recurring_context() from public,anon,authenticated;
create trigger cc_carry_home_recurring_context before insert on public.cc_records
 for each row execute function cc_private.carry_home_recurring_context();
commit;
