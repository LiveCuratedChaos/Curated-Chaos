-- Removes only the empty recovery input. Restored projects and their links remain intact.
begin;
drop view cc_private.restore_new_project_hierarchy;
drop function cc_private.restore_new_project_hierarchy();
commit;
