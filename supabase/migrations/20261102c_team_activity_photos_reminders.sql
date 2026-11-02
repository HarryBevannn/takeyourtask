-- Team management, archiving, activity history, task photos, reminders and performance.
-- Run once on an existing database: Dashboard → SQL Editor → paste this file → Run.
-- (The email-sending schedule is set up separately; see supabase/README.md.)

-- ─── Team management ────────────────────────────────────────────────────────

create function public.regenerate_invite_code(ws uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not is_manager(ws) then raise exception 'Only managers can change the invite code'; end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update workspaces set invite_code = code where id = ws;
  return code;
end $$;

-- Members can only have their role changed, and a workspace always keeps a manager.
create function public.guard_membership_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.workspace_id <> old.workspace_id or new.user_id <> old.user_id) then
    raise exception 'Only a member''s role can be changed';
  end if;
  if old.role = 'manager'
     and (tg_op = 'DELETE' or new.role <> 'manager')
     and exists (select 1 from workspaces where id = old.workspace_id)
     and exists (select 1 from profiles where id = old.user_id)
     and not exists (
       select 1 from workspace_members
       where workspace_id = old.workspace_id and role = 'manager' and user_id <> old.user_id
     ) then
    raise exception 'A workspace needs at least one manager. Make someone else a manager first.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger members_guard
  before update or delete on public.workspace_members
  for each row execute function public.guard_membership_change();

-- Someone who leaves or is removed no longer holds that workspace's tasks.
create function public.after_member_leave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update tasks set assignee_id = null where workspace_id = old.workspace_id and assignee_id = old.user_id;
  return old;
end $$;

create trigger members_after_delete
  after delete on public.workspace_members
  for each row execute function public.after_member_leave();

-- ─── Profiles: email preference ─────────────────────────────────────────────

alter table public.profiles add column email_notifications boolean not null default true;

-- ─── Archiving: remember when a task reached the last column ───────────────

alter table public.tasks add column completed_at timestamptz;

update public.tasks t set completed_at = t.updated_at
where t.column_id = (
  select c.id from public.board_columns c where c.workspace_id = t.workspace_id order by c.position desc limit 1
);

create index on public.tasks (workspace_id, completed_at);

create or replace function public.before_task_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_column uuid;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    update workspaces set task_counter = task_counter + 1
      where id = new.workspace_id
      returning task_counter into new.number;
  else
    new.number := old.number;
    new.created_by := old.created_by;
  end if;

  select id into last_column from board_columns
    where workspace_id = new.workspace_id order by position desc limit 1;
  if new.column_id is distinct from last_column then
    new.completed_at := null;
  elsif tg_op = 'INSERT' or old.completed_at is null then
    new.completed_at := now();
  else
    new.completed_at := old.completed_at;
  end if;

  new.updated_at := now();
  return new;
end $$;

-- ─── Activity history ───────────────────────────────────────────────────────

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  actor_id uuid references public.profiles on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create index on public.task_events (task_id);
create index on public.task_events (workspace_id);
create index on public.task_events (actor_id);

alter table public.task_events enable row level security;
create policy "members see activity" on public.task_events for select
  using (public.is_member(workspace_id));

create or replace function public.after_task_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := coalesce(actor_name(), 'Someone');
  col text;
  assignee text;
begin
  if tg_op = 'INSERT' then
    insert into task_events (task_id, workspace_id, actor_id, message)
      values (new.id, new.workspace_id, auth.uid(), 'created this');
    perform notify(new.assignee_id, new.workspace_id, new.id, 'assigned',
      actor || ' assigned you "' || new.title || '"');
    return new;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    select coalesce(nullif(full_name, ''), email) into assignee from profiles where id = new.assignee_id;
    insert into task_events (task_id, workspace_id, actor_id, message)
      values (new.id, new.workspace_id, auth.uid(),
        case when new.assignee_id is null then 'unassigned this'
             else 'assigned this to ' || coalesce(assignee, 'someone') end);
    perform notify(new.assignee_id, new.workspace_id, new.id, 'assigned',
      actor || ' assigned you "' || new.title || '"');
  end if;

  if new.column_id is distinct from old.column_id then
    select name into col from board_columns where id = new.column_id;
    insert into task_events (task_id, workspace_id, actor_id, message)
      values (new.id, new.workspace_id, auth.uid(), 'moved this to ' || col);
    perform notify(new.assignee_id, new.workspace_id, new.id, 'moved',
      actor || ' moved "' || new.title || '" to ' || col);
    if new.created_by is distinct from new.assignee_id then
      perform notify(new.created_by, new.workspace_id, new.id, 'moved',
        actor || ' moved "' || new.title || '" to ' || col);
    end if;
  end if;

  if new.due_date is distinct from old.due_date then
    insert into task_events (task_id, workspace_id, actor_id, message)
      values (new.id, new.workspace_id, auth.uid(),
        case when new.due_date is null then 'removed the due date'
             else 'set the due date to ' || to_char(new.due_date, 'FMDD Mon') end);
  end if;

  if new.title is distinct from old.title then
    insert into task_events (task_id, workspace_id, actor_id, message)
      values (new.id, new.workspace_id, auth.uid(), 'renamed this');
  end if;

  return new;
end $$;

-- ─── Task photos (private: only members of the workspace can see them) ─────

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  path text not null unique,
  uploaded_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create index on public.task_attachments (task_id);
create index on public.task_attachments (workspace_id);
create index on public.task_attachments (uploaded_by);

alter table public.task_attachments enable row level security;
create policy "members see photos" on public.task_attachments for select
  using (public.is_member(workspace_id));
create policy "members add photos" on public.task_attachments for insert
  with check (
    public.is_member(workspace_id)
    and uploaded_by = (select auth.uid())
    and path like workspace_id::text || '/%'
    and exists (select 1 from tasks t where t.id = task_id and t.workspace_id = task_attachments.workspace_id)
  );
create policy "uploaders and managers remove photos" on public.task_attachments for delete
  using (uploaded_by = (select auth.uid()) or public.is_manager(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "members view task photos" on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members upload task photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "uploaders and managers delete task photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-photos'
    and (owner_id = (select auth.uid())::text or public.is_manager(((storage.foldername(name))[1])::uuid))
  );

-- ─── Due-date reminders and email delivery bookkeeping ─────────────────────

alter table public.notifications add column emailed_at timestamptz;

create function public.create_due_reminders() returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, workspace_id, task_id, type, message)
  select t.assignee_id, t.workspace_id, t.id, 'due', '"' || t.title || '" is due tomorrow'
  from tasks t
  where t.due_date = current_date + 1
    and t.assignee_id is not null
    and t.completed_at is null
    and not exists (
      select 1 from notifications n
      where n.task_id = t.id and n.type = 'due' and n.created_at > now() - interval '20 hours'
    );
$$;

create extension if not exists pg_cron;
select cron.schedule('due-reminders', '0 7 * * *', 'select public.create_due_reminders()');

-- ─── Grants ─────────────────────────────────────────────────────────────────

revoke execute on function
  public.regenerate_invite_code(uuid),
  public.guard_membership_change(),
  public.after_member_leave(),
  public.create_due_reminders()
from public, anon, authenticated;

grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ─── Performance: index foreign keys, evaluate auth.uid() once per query ───

create index on public.checklist_items (workspace_id);
create index on public.comments (author_id);
create index on public.comments (workspace_id);
create index on public.notifications (actor_id);
create index on public.notifications (task_id);
create index on public.notifications (workspace_id);
create index on public.tasks (assignee_id);
create index on public.tasks (column_id);
create index on public.tasks (created_by);
create index on public.workspace_members (user_id);
create index on public.workspaces (created_by);

alter policy "see self and teammates" on public.profiles
  using (id = (select auth.uid()) or public.shares_workspace(id));
alter policy "edit own profile" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "managers remove members, anyone can leave" on public.workspace_members
  using (public.is_manager(workspace_id) or user_id = (select auth.uid()));
alter policy "members comment as themselves" on public.comments
  with check (
    public.is_member(workspace_id)
    and author_id = (select auth.uid())
    and exists (select 1 from tasks t where t.id = task_id and t.workspace_id = comments.workspace_id)
  );
alter policy "authors delete own comments" on public.comments
  using (author_id = (select auth.uid()));
alter policy "see own notifications" on public.notifications
  using (user_id = (select auth.uid()));
alter policy "mark own notifications read" on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.task_events, public.task_attachments, public.profiles;

notify pgrst, 'reload schema';
