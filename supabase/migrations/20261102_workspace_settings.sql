-- Per-company settings: branding, task fields, staff permissions and board defaults.
-- Run once on an existing database: Dashboard → SQL Editor → paste this file → Run.
-- (Fresh installs get all of this from schema.sql.)

alter table public.workspaces
  add column logo_url text check (logo_url ~ '^https://'),
  add column accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add column location_label text not null default 'Location'
    check (char_length(trim(location_label)) between 1 and 30),
  add column show_location boolean not null default true,
  add column show_priority boolean not null default true,
  add column priority_labels jsonb not null default '{}' check (jsonb_typeof(priority_labels) = 'object'),
  add column default_priority text not null default 'medium'
    check (default_priority in ('low', 'medium', 'high', 'urgent')),
  add column staff_can_create_tasks boolean not null default false,
  add column staff_can_delete_tasks boolean not null default false,
  add column staff_can_manage_columns boolean not null default false;

-- Managers can always; staff only when the workspace switches that permission on.
create function public.has_permission(ws uuid, action text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members m join workspaces w on w.id = m.workspace_id
    where m.workspace_id = ws and m.user_id = auth.uid()
      and (m.role = 'manager' or case action
        when 'create_tasks' then w.staff_can_create_tasks
        when 'delete_tasks' then w.staff_can_delete_tasks
        when 'manage_columns' then w.staff_can_manage_columns
        else false end)
  );
$$;

drop policy "managers add columns" on public.board_columns;
drop policy "managers edit columns" on public.board_columns;
drop policy "managers delete columns" on public.board_columns;
create policy "permitted members add columns" on public.board_columns for insert
  with check (public.has_permission(workspace_id, 'manage_columns'));
create policy "permitted members edit columns" on public.board_columns for update
  using (public.has_permission(workspace_id, 'manage_columns'))
  with check (public.has_permission(workspace_id, 'manage_columns'));
create policy "permitted members delete columns" on public.board_columns for delete
  using (public.has_permission(workspace_id, 'manage_columns'));

drop policy "managers create tasks" on public.tasks;
drop policy "managers delete tasks" on public.tasks;
create policy "permitted members create tasks" on public.tasks for insert
  with check (
    public.has_permission(workspace_id, 'create_tasks')
    and exists (select 1 from board_columns c where c.id = column_id and c.workspace_id = tasks.workspace_id)
  );
create policy "permitted members delete tasks" on public.tasks for delete
  using (public.has_permission(workspace_id, 'delete_tasks'));

-- New workspaces can start from a column template.
drop function public.create_workspace(text);
create function public.create_workspace(ws_name text, column_names text[] default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if cardinality(column_names) > 12 then raise exception 'A board can start with at most 12 columns'; end if;
  if coalesce(cardinality(column_names), 0) = 0 then column_names := array['To do', 'In progress', 'Done']; end if;
  insert into workspaces (name, created_by) values (trim(ws_name), auth.uid()) returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'manager');
  insert into board_columns (workspace_id, name, position)
    select ws, trim(n), i from unnest(column_names) with ordinality as t(n, i);
  return ws;
end $$;

revoke execute on function public.create_workspace(text, text[]), public.has_permission(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_workspace(text, text[]), public.has_permission(uuid, text)
  to authenticated;

-- Company logos: public to read, uploadable by that workspace's managers into <workspace id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "managers upload workspace logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_manager(((storage.foldername(name))[1])::uuid));

-- Settings changes reach everyone's open board instantly.
alter publication supabase_realtime add table public.workspaces;
