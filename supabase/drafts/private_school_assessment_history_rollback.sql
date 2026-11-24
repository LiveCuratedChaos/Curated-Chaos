-- PREPARED ONLY. Refuse rollback while any record retains assessment history.
begin;
set local lock_timeout='3s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin if exists(select 1 from public.cc_records where jsonb_path_exists(payload,'$.**.learningRecord')) then raise exception 'Keep assessment history protections while saved records depend on them';end if;end$$;
drop function public.update_private_school_assessment_history(uuid,integer,jsonb);
drop function public.cc_private_school_assessment_history_ready();
drop trigger cc_school_assessment_history_guard on public.cc_records;
drop function cc_private.school_assessment_history_guard();
drop function cc_private.school_assessment_history_valid(jsonb);
drop function cc_private.school_assessment_nodes(jsonb);
commit;
