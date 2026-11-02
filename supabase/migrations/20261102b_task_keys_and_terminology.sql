-- Stable task ID prefixes (so renaming a workspace doesn't change "KIN-4" to something else)
-- and per-company names for tasks ("job", "task", "ticket" …).
-- Run once on an existing database: Dashboard → SQL Editor → paste this file → Run.

alter table public.workspaces
  add column key_prefix text not null default 'TYT' check (key_prefix ~ '^[A-Z]{2,5}$'),
  add column item_name text not null default 'job' check (char_length(trim(item_name)) between 1 and 20),
  add column item_name_plural text not null default 'jobs'
    check (char_length(trim(item_name_plural)) between 1 and 20);

-- Keep the prefixes people already see today.
update public.workspaces
set key_prefix = upper(left(regexp_replace(name, '[^a-zA-Z]', '', 'g'), 3))
where char_length(regexp_replace(name, '[^a-zA-Z]', '', 'g')) >= 2;

create or replace function public.create_workspace(ws_name text, column_names text[] default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  letters text := upper(left(regexp_replace(ws_name, '[^a-zA-Z]', '', 'g'), 3));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if cardinality(column_names) > 12 then raise exception 'A board can start with at most 12 columns'; end if;
  if coalesce(cardinality(column_names), 0) = 0 then column_names := array['To do', 'In progress', 'Done']; end if;
  insert into workspaces (name, created_by, key_prefix)
    values (trim(ws_name), auth.uid(), case when char_length(letters) >= 2 then letters else 'TYT' end)
    returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'manager');
  insert into board_columns (workspace_id, name, position)
    select ws, trim(n), i from unnest(column_names) with ordinality as t(n, i);
  return ws;
end $$;

notify pgrst, 'reload schema';
