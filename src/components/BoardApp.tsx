"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, Search, Settings, Users, X } from "lucide-react";
import Avatar from "./Avatar";
import Board from "./Board";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import SetupNotice from "./SetupNotice";
import TaskModal from "./TaskModal";
import Toasts from "./Toasts";
import WorkspaceSettings from "./WorkspaceSettings";
import type { CardExtras } from "./TaskCard";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type {
  AppNotification,
  ChecklistItem,
  Column,
  Comment,
  Member,
  Membership,
  Task,
  Toast,
  Workspace,
  WorkspaceSettings as SettingsPatch,
} from "@/lib/types";
import {
  WORKSPACE_KEY,
  brandStyle,
  byPosition,
  displayName,
  capitalize,
  fieldConfig,
  positionBetween,
  upsert,
} from "@/lib/utils";

type DbError = { message: string } | null;

export default function BoardApp() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [wsId, setWsId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [boardReady, setBoardReady] = useState(false);

  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [live, setLive] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [desktopEnabled, setDesktopEnabled] = useState(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
  );

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openTaskRef = useRef<string | null>(null);
  useEffect(() => {
    openTaskRef.current = openTaskId;
  }, [openTaskId]);

  // ─── Helpers ──────────────────────────────────────────────────────────

  const dismissToast = useCallback((id: string) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  const pushToast = useCallback(
    (message: string, kind: Toast["kind"] = "info", taskId?: string | null, workspaceId?: string) => {
      const id = crypto.randomUUID();
      setToasts((l) => [...l.slice(-3), { id, message, kind, taskId, workspaceId }]);
      setTimeout(() => dismissToast(id), 6000);
    },
    [dismissToast],
  );

  const report = useCallback(
    (error: DbError) => {
      if (!error) return false;
      pushToast(error.message, "error");
      setReloadKey((k) => k + 1);
      return true;
    },
    [pushToast],
  );

  const applyWorkspace = useCallback((ws: Workspace) => {
    setMemberships((l) =>
      l?.map((m) => (m.workspace.id === ws.id ? { ...m, workspace: { ...m.workspace, ...ws } } : m)) ?? l,
    );
  }, []);

  // ─── Session ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
      else setUserId(session.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  // ─── Workspaces the user belongs to ───────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role, workspace:workspaces(*)")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) return pushToast(error.message, "error");
      const list = (data ?? []) as unknown as Membership[];
      if (list.length === 0) return router.replace("/onboarding");

      let stored: string | null = null;
      try {
        stored = localStorage.getItem(WORKSPACE_KEY);
      } catch {}
      setMemberships(list);
      setWsId(
        (current) =>
          (current && list.some((m) => m.workspace.id === current) ? current : null) ??
          list.find((m) => m.workspace.id === stored)?.workspace.id ??
          list[0].workspace.id,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, router, pushToast]);

  // ─── Board data ───────────────────────────────────────────────────────

  const loadMembers = useCallback(async (workspaceId: string) => {
    const { data } = await supabase
      .from("workspace_members")
      .select("user_id, role, profile:profiles(id, full_name, email)")
      .eq("workspace_id", workspaceId);
    setMembers((data ?? []) as unknown as Member[]);
  }, []);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    (async () => {
      const [cols, tks, items] = await Promise.all([
        supabase.from("board_columns").select("*").eq("workspace_id", wsId),
        supabase.from("tasks").select("*").eq("workspace_id", wsId),
        supabase.from("checklist_items").select("*").eq("workspace_id", wsId),
        loadMembers(wsId),
      ]);
      if (cancelled) return;
      const error = cols.error ?? tks.error ?? items.error;
      if (error) pushToast(error.message, "error");
      setColumns((cols.data ?? []) as Column[]);
      setTasks((tks.data ?? []) as Task[]);
      setChecklist((items.data ?? []) as ChecklistItem[]);
      setBoardReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, reloadKey, loadMembers, pushToast]);

  // ─── Live updates + presence for the open workspace ───────────────────

  useEffect(() => {
    if (!wsId || !userId) return;
    const filter = `workspace_id=eq.${wsId}`;
    const channel = supabase.channel(`workspace:${wsId}`, { config: { presence: { key: userId } } });

    function syncTable<T extends { id: string }>(table: string, set: Dispatch<SetStateAction<T[]>>) {
      channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, (p) =>
          set((l) => upsert(l, p.new as T)),
        )
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, (p) =>
          set((l) => upsert(l, p.new as T)),
        )
        // Delete events can't be filtered server-side; unknown ids are simply ignored.
        .on("postgres_changes", { event: "DELETE", schema: "public", table }, (p) =>
          set((l) => l.filter((x) => x.id !== (p.old as { id: string }).id)),
        );
    }

    syncTable<Task>("tasks", setTasks);
    syncTable<Column>("board_columns", setColumns);
    syncTable<ChecklistItem>("checklist_items", setChecklist);

    let firstConnect = true;
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter }, (p) => {
        const c = p.new as Comment;
        if (c.task_id === openTaskRef.current) setComments((l) => upsert(l, c));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "comments" }, (p) =>
        setComments((l) => l.filter((c) => c.id !== (p.old as { id: string }).id)),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter }, () =>
        loadMembers(wsId),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workspaces", filter: `id=eq.${wsId}` }, (p) =>
        applyWorkspace(p.new as Workspace),
      )
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe(async (status) => {
        setLive(status === "SUBSCRIBED");
        if (status !== "SUBSCRIBED") return;
        // After a dropped connection, refetch so nothing missed while offline is lost.
        if (!firstConnect) setReloadKey((k) => k + 1);
        firstConnect = false;
        await channel.track({ since: new Date().toISOString() });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wsId, userId, loadMembers, applyWorkspace]);

  // ─── Notifications (across all workspaces) ────────────────────────────

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (!cancelled) setNotifications((data ?? []) as AppNotification[]);
      });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (p) => {
          const n = p.new as AppNotification;
          setNotifications((l) => [n, ...l.filter((x) => x.id !== n.id)].slice(0, 40));
          pushToast(n.message, "info", n.task_id, n.workspace_id);
          if (
            document.visibilityState !== "visible" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const alert = new Notification("TakeYourTask", { body: n.message, tag: n.id });
            alert.onclick = () => {
              window.focus();
              if (n.task_id) setOpenTaskId(n.task_id);
            };
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, pushToast]);

  const unread = notifications.filter((n) => !n.read).length;
  useEffect(() => {
    document.title = unread ? `(${unread}) TakeYourTask` : "TakeYourTask";
  }, [unread]);

  // ─── Comments for the open task ────────────────────────────────────────

  useEffect(() => {
    if (!openTaskId) return;
    let cancelled = false;
    supabase
      .from("comments")
      .select("*")
      .eq("task_id", openTaskId)
      .then(({ data }) => {
        if (!cancelled) setComments((data ?? []) as Comment[]);
      });
    return () => {
      cancelled = true;
    };
  }, [openTaskId]);

  // ─── Actions ──────────────────────────────────────────────────────────

  function switchWorkspace(id: string) {
    if (id === wsId) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, id);
    } catch {}
    setBoardReady(false);
    setColumns([]);
    setTasks([]);
    setChecklist([]);
    setAssigneeFilter(null);
    setWsId(id);
  }

  function openTask(taskId: string, workspaceId?: string) {
    if (workspaceId && workspaceId !== wsId) switchWorkspace(workspaceId);
    setOpenTaskId(taskId);
  }

  function lastPosition(columnId: string) {
    return tasks.filter((t) => t.column_id === columnId).sort(byPosition).at(-1)?.position;
  }

  async function moveTask(id: string, columnId: string, position: number) {
    setTasks((l) => l.map((t) => (t.id === id ? { ...t, column_id: columnId, position } : t)));
    const { error } = await supabase.from("tasks").update({ column_id: columnId, position }).eq("id", id);
    report(error);
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    const current = tasks.find((t) => t.id === id);
    if (current && patch.column_id && patch.column_id !== current.column_id) {
      patch = { ...patch, position: positionBetween(lastPosition(patch.column_id), undefined) };
    }
    setTasks((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
    if (!report(error) && data) setTasks((l) => upsert(l, data as Task));
  }

  async function createTask(columnId: string, title: string) {
    if (!wsId) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: wsId,
        column_id: columnId,
        title,
        priority: workspace?.default_priority ?? "medium",
        position: positionBetween(lastPosition(columnId), undefined),
      })
      .select()
      .single();
    if (!report(error) && data) setTasks((l) => upsert(l, data as Task));
  }

  async function deleteTask(id: string) {
    setOpenTaskId(null);
    setTasks((l) => l.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    report(error);
  }

  async function addColumn(name: string) {
    if (!wsId) return;
    const last = columns.slice().sort(byPosition).at(-1);
    const { data, error } = await supabase
      .from("board_columns")
      .insert({ workspace_id: wsId, name, position: positionBetween(last?.position, undefined) })
      .select()
      .single();
    if (!report(error) && data) setColumns((l) => upsert(l, data as Column));
  }

  async function renameColumn(id: string, name: string) {
    setColumns((l) => l.map((c) => (c.id === id ? { ...c, name } : c)));
    const { error } = await supabase.from("board_columns").update({ name }).eq("id", id);
    report(error);
  }

  async function deleteColumn(id: string) {
    const col = columns.find((c) => c.id === id);
    if (!col || !confirm(`Delete the "${col.name}" column?`)) return;
    setColumns((l) => l.filter((c) => c.id !== id));
    const { error } = await supabase.from("board_columns").delete().eq("id", id);
    report(error);
  }

  async function addChecklistItem(task: Task, label: string) {
    const last = checklist.filter((i) => i.task_id === task.id).sort(byPosition).at(-1);
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({
        task_id: task.id,
        workspace_id: task.workspace_id,
        label,
        position: positionBetween(last?.position, undefined),
      })
      .select()
      .single();
    if (!report(error) && data) setChecklist((l) => upsert(l, data as ChecklistItem));
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    setChecklist((l) => l.map((i) => (i.id === item.id ? { ...i, done: !item.done } : i)));
    const { error } = await supabase.from("checklist_items").update({ done: !item.done }).eq("id", item.id);
    report(error);
  }

  async function deleteChecklistItem(id: string) {
    setChecklist((l) => l.filter((i) => i.id !== id));
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    report(error);
  }

  async function addComment(task: Task, body: string) {
    const { data, error } = await supabase
      .from("comments")
      .insert({ task_id: task.id, workspace_id: task.workspace_id, author_id: userId, body })
      .select()
      .single();
    if (error) pushToast(error.message, "error");
    else if (data) setComments((l) => upsert(l, data as Comment));
  }

  async function openNotification(n: AppNotification) {
    if (n.task_id) openTask(n.task_id, n.workspace_id);
    if (n.read) return;
    setNotifications((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);
  }

  async function markAllRead() {
    setNotifications((l) => l.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  }

  async function enableDesktopAlerts() {
    if (!("Notification" in window)) return pushToast("This browser doesn't support desktop alerts.", "error");
    const permission = await Notification.requestPermission();
    setDesktopEnabled(permission === "granted");
    if (permission === "denied") pushToast("Desktop alerts are blocked in your browser's site settings.", "error");
  }

  async function saveSettings(patch: Partial<SettingsPatch>) {
    if (!wsId) return false;
    const { data, error } = await supabase.from("workspaces").update(patch).eq("id", wsId).select().single();
    if (error) {
      pushToast(error.message, "error");
      return false;
    }
    applyWorkspace(data as Workspace);
    pushToast("Settings saved");
    return true;
  }

  async function uploadLogo(file: File) {
    if (!wsId) return null;
    const ext = file.type.split("/")[1] ?? "png";
    const path = `${wsId}/${crypto.randomUUID()}.${ext}`;
    const bucket = supabase.storage.from("logos");
    const { error } = await bucket.upload(path, file, { contentType: file.type });
    if (error) {
      pushToast(error.message, "error");
      return null;
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ─── Derived view data ────────────────────────────────────────────────

  const membership = memberships?.find((m) => m.workspace.id === wsId);
  const workspace = membership?.workspace;
  const isManager = membership?.role === "manager";
  const canCreate = isManager || Boolean(workspace?.staff_can_create_tasks);
  const canDelete = isManager || Boolean(workspace?.staff_can_delete_tasks);
  const canManageColumns = isManager || Boolean(workspace?.staff_can_manage_columns);
  const fields = useMemo(() => fieldConfig(workspace), [workspace]);
  const prefix = workspace?.key_prefix || "TYT";
  const sortedColumns = useMemo(() => columns.slice().sort(byPosition), [columns]);
  const doneColumnId = sortedColumns.at(-1)?.id;
  const profileById = useMemo(() => new Map(members.map((m) => [m.user_id, m.profile])), [members]);
  const me = userId ? profileById.get(userId) : undefined;

  const checklistCounts = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const item of checklist) {
      const c = map.get(item.task_id) ?? { done: 0, total: 0 };
      c.total += 1;
      if (item.done) c.done += 1;
      map.set(item.task_id, c);
    }
    return map;
  }, [checklist]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        `${prefix}-${t.number}`.toLowerCase().includes(q)
      );
    });
  }, [tasks, search, assigneeFilter, prefix]);

  const extrasFor = useCallback(
    (task: Task): CardExtras => ({
      prefix,
      fields,
      assignee: task.assignee_id ? profileById.get(task.assignee_id) : undefined,
      assigneeOnline: task.assignee_id ? online.has(task.assignee_id) : false,
      checklist: checklistCounts.get(task.id),
      done: task.column_id === doneColumnId,
    }),
    [prefix, fields, profileById, online, checklistCounts, doneColumnId],
  );

  const openTaskData = openTaskId ? tasks.find((t) => t.id === openTaskId) : undefined;
  const doneCount = tasks.filter((t) => t.column_id === doneColumnId).length;

  // ─── Render ───────────────────────────────────────────────────────────

  if (!supabaseConfigured) return <SetupNotice />;

  if (!boardReady || !workspace) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="glass flex items-center gap-3 rounded-2xl px-5 py-4 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
          Loading your board…
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col" style={brandStyle(workspace.accent_color)}>
      <header className="glass relative z-30 mx-3 mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 sm:mx-6 sm:gap-3 sm:px-4">
        {workspace.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={workspace.logo_url} alt={workspace.name} className="h-8 w-auto max-w-32 rounded-lg object-contain" />
        ) : (
          <Logo />
        )}
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />

        {memberships && memberships.length > 1 ? (
          <select
            className="input w-auto max-w-[45vw] py-1.5 text-sm font-medium"
            value={wsId ?? ""}
            onChange={(e) => switchWorkspace(e.target.value)}
            aria-label="Workspace"
          >
            {memberships.map((m) => (
              <option key={m.workspace.id} value={m.workspace.id}>
                {m.workspace.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="hidden truncate text-sm font-medium sm:block">{workspace.name}</span>
        )}

        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs md:flex ${
            live ? "bg-success/15 text-success" : "bg-[#ffd166]/15 text-[#ffd166]"
          }`}
          title={live ? "Changes appear instantly" : "Reconnecting to live updates"}
        >
          <span className="relative flex h-2 w-2">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-success" : "bg-[#ffd166]"}`} />
          </span>
          {live ? "Live" : "Reconnecting…"}
        </span>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="relative">
            <button className="btn btn-ghost px-2.5" onClick={() => setInviteOpen(!inviteOpen)} aria-label="Team">
              <Users size={19} />
              <span className="hidden sm:inline">Team</span>
            </button>
            {inviteOpen && (
              <div className="glass-strong pop-in absolute right-0 z-50 mt-2 w-[min(92vw,340px)] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Team</h3>
                  <button className="text-faint hover:text-foreground" onClick={() => setInviteOpen(false)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                {isManager && (
                  <div className="mt-3 rounded-xl bg-black/20 p-3">
                    <p className="text-xs text-muted">Invite code. Teammates sign up, choose “Join your team” and enter:</p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 font-mono text-lg tracking-[0.25em]">{workspace.invite_code}</code>
                      <button
                        className="btn px-2.5 py-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(workspace.invite_code);
                          pushToast("Invite code copied");
                        }}
                      >
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                  </div>
                )}
                <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {members.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                      <Avatar profile={m.profile} size={28} online={online.has(m.user_id)} />
                      <span className="flex-1 truncate text-sm">
                        {displayName(m.profile)}
                        {m.user_id === userId && <span className="text-faint"> (you)</span>}
                      </span>
                      <span className="text-xs text-faint capitalize">{m.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isManager && (
            <button
              className="btn btn-ghost px-2.5"
              onClick={() => setSettingsOpen(true)}
              aria-label="Workspace settings"
              title="Workspace settings"
            >
              <Settings size={18} />
            </button>
          )}

          <NotificationBell
            notifications={notifications}
            desktopEnabled={desktopEnabled}
            onEnableDesktop={enableDesktopAlerts}
            onOpen={openNotification}
            onMarkAllRead={markAllRead}
          />

          <span className="mx-1 h-6 w-px bg-white/15" />
          <Avatar profile={me} size={30} />
          <button className="btn btn-ghost px-2.5" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 pt-6 pb-4 sm:px-6">
        <div>
          <p className="text-xs text-faint">{workspace.name} / Board</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{capitalize(fields.itemNamePlural)} board</h1>
          <p className="mt-1 text-sm text-muted">
            {tasks.length} {tasks.length === 1 ? fields.itemName : fields.itemNamePlural} · {doneCount} done
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-end">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              className="input glass py-2 pl-9"
              placeholder={`Search ${fields.itemNamePlural}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center">
            {members.slice(0, 8).map((m) => (
              <button
                key={m.user_id}
                className={`-ml-1.5 rounded-full transition first:ml-0 hover:z-10 hover:-translate-y-0.5 ${
                  assigneeFilter === m.user_id ? "z-10 ring-2 ring-accent ring-offset-2 ring-offset-[#0d1230]" : ""
                } ${assigneeFilter && assigneeFilter !== m.user_id ? "opacity-40" : ""}`}
                onClick={() => setAssigneeFilter(assigneeFilter === m.user_id ? null : m.user_id)}
                title={`Show ${fields.itemNamePlural} for ${displayName(m.profile)}`}
              >
                <Avatar profile={m.profile} size={32} online={online.has(m.user_id)} />
              </button>
            ))}
            {userId && (
              <button
                className={`btn ml-3 py-1.5 text-xs ${assigneeFilter === userId ? "btn-primary" : ""}`}
                onClick={() => setAssigneeFilter(assigneeFilter === userId ? null : userId)}
              >
                Only my {fields.itemNamePlural}
              </button>
            )}
          </div>
        </div>
      </div>

      <Board
        columns={sortedColumns}
        tasks={visibleTasks}
        canCreate={canCreate}
        canManageColumns={canManageColumns}
        doneColumnId={doneColumnId}
        itemName={fields.itemName}
        extrasFor={extrasFor}
        onOpen={setOpenTaskId}
        onMove={moveTask}
        onCreate={createTask}
        onAddColumn={addColumn}
        onRenameColumn={renameColumn}
        onDeleteColumn={deleteColumn}
      />

      {openTaskData && userId && (
        <TaskModal
          task={openTaskData}
          prefix={prefix}
          fields={fields}
          columns={sortedColumns}
          members={members}
          checklist={checklist.filter((i) => i.task_id === openTaskData.id)}
          comments={comments.filter((c) => c.task_id === openTaskData.id)}
          currentUserId={userId}
          canDelete={canDelete}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(patch) => updateTask(openTaskData.id, patch)}
          onDelete={() => deleteTask(openTaskData.id)}
          onAddChecklist={(label) => addChecklistItem(openTaskData, label)}
          onToggleChecklist={toggleChecklistItem}
          onDeleteChecklist={deleteChecklistItem}
          onAddComment={(body) => addComment(openTaskData, body)}
        />
      )}

      {settingsOpen && isManager && (
        <WorkspaceSettings
          key={workspace.id}
          workspace={workspace}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onUploadLogo={uploadLogo}
        />
      )}

      <Toasts
        toasts={toasts}
        onDismiss={dismissToast}
        onOpenTask={(taskId) => {
          const toast = toasts.find((t) => t.taskId === taskId);
          openTask(taskId, toast?.workspaceId);
        }}
      />
    </div>
  );
}
