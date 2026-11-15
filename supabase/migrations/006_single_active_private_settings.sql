-- PREPARED ONLY: separate development project; owner approval before execution.
-- Fail rather than change any existing duplicate records. No data cleanup/upsert.
begin;
create unique index cc_one_active_private_settings_per_owner
 on public.cc_records (owner_id,item_type)
 where item_type in ('brief_preferences','dashboard_layout')
   and visibility='private' and household_id is null and deleted_at is null;
commit;
