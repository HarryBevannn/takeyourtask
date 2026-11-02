-- TakeYourTask database schema.
-- Run once on a fresh Supabase project: Dashboard → SQL Editor → paste this file → Run.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  invite_code text not null unique
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  task_counter int not null default 0,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  -- Per-company settings, editable by managers.
  logo_url text check (logo_url ~ '^https://'),
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  location_label text not null default 'Location' check (char_length(trim(location_label)) between 1 and 30),
  show_location boolean not null default true,
  show_priority boolean not null default true,
  priority_labels jsonb not null default '{}' check (jsonb_typeof(priority_labels) = 'object'),
  default_priority text not null default 'medium' check (default_priority in ('low', 'medium', 'high', 'urgent')),
  staff_can_create_tasks boolean not null default false,
  staff_can_delete_tasks boolean not null default false,
  staff_can_manage_columns boolean not null default false,
  -- Task IDs read <key_prefix>-<number>; stored so renaming the workspace doesn't change them.
  key_prefix text not null default 'TYT' check (key_prefix ~ '^[A-Z]{2,5}$'),
  item_name text not null default 'job' check (char_length(trim(item_name)) between 1 and 20),
  item_name_plural text not null default 'jobs' check (char_length(trim(item_name_plural)) between 1 and 20)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'staff' check (role in ('manager', 'staff')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  column_id uuid not null references public.board_columns,
  number int not null default 0,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '',
  location text not null default '',
  assignee_id uuid references public.profiles on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  position double precision not null default 0,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  author_id uuid default auth.uid() references public.profiles on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  task_id uuid references public.tasks on delete cascade,
  actor_id uuid references public.profiles on delete set null,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.tasks (workspace_id);
create index on public.board_columns (workspace_id);
create index on public.checklist_items (task_id);
create index on public.comments (task_id);
create index on public.notifications (user_id, created_at desc);

-- ─── Membership helpers (used by the security rules) ───────────────────────

create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

create function public.is_manager(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = 'manager'
  );
$$;

create function public.shares_workspace(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members a
    join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

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

-- ─── Row-level security: people only ever see their own workspaces ─────────

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

create policy "see self and teammates" on public.profiles for select
  using (id = auth.uid() or public.shares_workspace(id));
create policy "edit own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "members see workspace" on public.workspaces for select
  using (public.is_member(id));
create policy "managers rename workspace" on public.workspaces for update
  using (public.is_manager(id)) with check (public.is_manager(id));

create policy "members see members" on public.workspace_members for select
  using (public.is_member(workspace_id));
create policy "managers change roles" on public.workspace_members for update
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy "managers remove members, anyone can leave" on public.workspace_members for delete
  using (public.is_manager(workspace_id) or user_id = auth.uid());

create policy "members see columns" on public.board_columns for select
  using (public.is_member(workspace_id));
create policy "permitted members add columns" on public.board_columns for insert
  with check (public.has_permission(workspace_id, 'manage_columns'));
create policy "permitted members edit columns" on public.board_columns for update
  using (public.has_permission(workspace_id, 'manage_columns'))
  with check (public.has_permission(workspace_id, 'manage_columns'));
create policy "permitted members delete columns" on public.board_columns for delete
  using (public.has_permission(workspace_id, 'manage_columns'));

create policy "members see tasks" on public.tasks for select
  using (public.is_member(workspace_id));
create policy "permitted members create tasks" on public.tasks for insert
  with check (
    public.has_permission(workspace_id, 'create_tasks')
    and exists (select 1 from board_columns c where c.id = column_id and c.workspace_id = tasks.workspace_id)
  );
create policy "members update tasks" on public.tasks for update
  using (public.is_member(workspace_id))
  with check (
    public.is_member(workspace_id)
    and exists (select 1 from board_columns c where c.id = column_id and c.workspace_id = tasks.workspace_id)
  );
create policy "permitted members delete tasks" on public.tasks for delete
  using (public.has_permission(workspace_id, 'delete_tasks'));

create policy "members see checklist" on public.checklist_items for select
  using (public.is_member(workspace_id));
create policy "members add checklist" on public.checklist_items for insert
  with check (
    public.is_member(workspace_id)
    and exists (select 1 from tasks t where t.id = task_id and t.workspace_id = checklist_items.workspace_id)
  );
create policy "members tick checklist" on public.checklist_items for update
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members remove checklist" on public.checklist_items for delete
  using (public.is_member(workspace_id));

create policy "members see comments" on public.comments for select
  using (public.is_member(workspace_id));
create policy "members comment as themselves" on public.comments for insert
  with check (
    public.is_member(workspace_id)
    and author_id = auth.uid()
    and exists (select 1 from tasks t where t.id = task_id and t.workspace_id = comments.workspace_id)
  );
create policy "authors delete own comments" on public.comments for delete
  using (author_id = auth.uid());

create policy "see own notifications" on public.notifications for select
  using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Sign-up: create a profile for every new account ──────────────────────

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Workspaces: create one, or join one with an invite code ──────────────

create function public.create_workspace(ws_name text, column_names text[] default null) returns uuid
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

create function public.join_workspace(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into ws from workspaces where invite_code = upper(trim(code));
  if ws is null then raise exception 'That invite code is not valid'; end if;
  insert into workspace_members (workspace_id, user_id, role)
    values (ws, auth.uid(), 'staff')
    on conflict do nothing;
  return ws;
end $$;

-- ─── Task numbers (TYT-1, TYT-2 …) and updated_at ─────────────────────────

create function public.before_task_write() returns trigger
language plpgsql security definer set search_path = public as $$
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
  new.updated_at := now();
  return new;
end $$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.before_task_write();

-- ─── Notifications ────────────────────────────────────────────────────────

create function public.actor_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), email, 'Someone') from profiles where id = auth.uid();
$$;

create function public.notify(recipient uuid, ws uuid, task uuid, kind text, msg text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, workspace_id, task_id, actor_id, type, message)
  select recipient, ws, task, auth.uid(), kind, msg
  where recipient is not null and recipient is distinct from auth.uid();
$$;

create function public.after_task_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := coalesce(actor_name(), 'Someone');
  col text;
begin
  if tg_op = 'INSERT' then
    perform notify(new.assignee_id, new.workspace_id, new.id, 'assigned',
      actor || ' assigned you "' || new.title || '"');
    return new;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    perform notify(new.assignee_id, new.workspace_id, new.id, 'assigned',
      actor || ' assigned you "' || new.title || '"');
  end if;

  if new.column_id is distinct from old.column_id then
    select name into col from board_columns where id = new.column_id;
    perform notify(new.assignee_id, new.workspace_id, new.id, 'moved',
      actor || ' moved "' || new.title || '" to ' || col);
    if new.created_by is distinct from new.assignee_id then
      perform notify(new.created_by, new.workspace_id, new.id, 'moved',
        actor || ' moved "' || new.title || '" to ' || col);
    end if;
  end if;

  return new;
end $$;

create trigger tasks_after_write
  after insert or update on public.tasks
  for each row execute function public.after_task_write();

create function public.after_comment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := coalesce(actor_name(), 'Someone');
  t record;
begin
  select title, assignee_id, created_by into t from tasks where id = new.task_id;
  perform notify(t.assignee_id, new.workspace_id, new.task_id, 'comment',
    actor || ' commented on "' || t.title || '"');
  if t.created_by is distinct from t.assignee_id then
    perform notify(t.created_by, new.workspace_id, new.task_id, 'comment',
      actor || ' commented on "' || t.title || '"');
  end if;
  return new;
end $$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function public.after_comment_insert();

create function public.after_member_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  joiner text;
  m record;
begin
  select coalesce(nullif(full_name, ''), email, 'Someone') into joiner from profiles where id = new.user_id;
  for m in select user_id from workspace_members
           where workspace_id = new.workspace_id and role = 'manager' and user_id <> new.user_id loop
    insert into notifications (user_id, workspace_id, actor_id, type, message)
      values (m.user_id, new.workspace_id, new.user_id, 'joined', joiner || ' joined the workspace');
  end loop;
  return new;
end $$;

create trigger members_after_insert
  after insert on public.workspace_members
  for each row execute function public.after_member_join();

-- Internal helpers must not be callable directly from the browser. Functions are
-- executable by PUBLIC by default, so revoke from everyone, then grant back only
-- what signed-in users need (the two RPCs, plus the helpers RLS policies call).
revoke execute on function
  public.actor_name(),
  public.notify(uuid, uuid, uuid, text, text),
  public.handle_new_user(),
  public.before_task_write(),
  public.after_task_write(),
  public.after_comment_insert(),
  public.after_member_join(),
  public.create_workspace(text, text[]),
  public.join_workspace(text),
  public.is_member(uuid),
  public.is_manager(uuid),
  public.shares_workspace(uuid),
  public.has_permission(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.create_workspace(text, text[]),
  public.join_workspace(text),
  public.is_member(uuid),
  public.is_manager(uuid),
  public.shares_workspace(uuid),
  public.has_permission(uuid, text)
to authenticated;

-- ─── Company logos: public to read, uploadable by that workspace's managers ─

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "managers upload workspace logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_manager(((storage.foldername(name))[1])::uuid));

-- ─── Realtime: stream every change to connected browsers ──────────────────

alter publication supabase_realtime add table
  public.workspaces,
  public.tasks,
  public.board_columns,
  public.checklist_items,
  public.comments,
  public.notifications,
  public.workspace_members;
