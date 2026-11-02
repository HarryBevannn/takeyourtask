"use client";

import { useEffect, useState } from "react";
import { Check, MapPin, Send, Trash2, X } from "lucide-react";
import Avatar from "./Avatar";
import TaskPhotos from "./TaskPhotos";
import type {
  Attachment,
  ChecklistItem,
  Column,
  Comment,
  FieldConfig,
  Member,
  Priority,
  Task,
  TaskEvent,
} from "@/lib/types";
import { PRIORITIES, PRIORITY_ORDER, byPosition, displayName, timeAgo } from "@/lib/utils";

type ActivityEntry = { kind: "comment"; item: Comment } | { kind: "event"; item: TaskEvent };

interface TaskModalProps {
  task: Task;
  prefix: string;
  fields: FieldConfig;
  columns: Column[];
  members: Member[];
  checklist: ChecklistItem[];
  comments: Comment[];
  events: TaskEvent[];
  attachments: Attachment[];
  currentUserId: string;
  canDelete: boolean;
  isManager: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onAddChecklist: (label: string) => void;
  onToggleChecklist: (item: ChecklistItem) => void;
  onDeleteChecklist: (id: string) => void;
  onAddComment: (body: string) => Promise<void>;
  onDeleteComment: (id: string) => void;
  onAddPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (attachment: Attachment) => void;
}

export default function TaskModal(props: TaskModalProps) {
  const { task, prefix, fields, columns, members, checklist, comments, canDelete, onClose, onUpdate } = props;
  const [newItem, setNewItem] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const profileById = new Map(members.map((m) => [m.user_id, m.profile]));
  const items = checklist.slice().sort(byPosition);
  const done = items.filter((i) => i.done).length;
  const activity: ActivityEntry[] = [
    ...comments.map((item) => ({ kind: "comment" as const, item })),
    ...props.events.map((item) => ({ kind: "event" as const, item })),
  ].sort((a, b) => b.item.created_at.localeCompare(a.item.created_at));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function sendComment() {
    const body = comment.trim();
    if (!body) return;
    setSending(true);
    await props.onAddComment(body);
    setSending(false);
    setComment("");
  }

  // Text fields save on blur; keying on updated_at picks up edits made by teammates.
  const textKey = `${task.id}:${task.updated_at}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        className="glass-strong pop-in flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <span className="font-mono text-xs tracking-wide text-faint">
            {prefix}-{task.number}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {canDelete && (
              <button
                className="btn btn-ghost text-danger"
                onClick={() => {
                  if (confirm(`Delete "${task.title}"? This can't be undone.`)) props.onDelete();
                }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1fr_260px]">
          <div className="min-w-0 space-y-6">
            <textarea
              key={`title:${textKey}`}
              className="w-full resize-none bg-transparent text-xl font-semibold outline-none"
              rows={1}
              defaultValue={task.title}
              maxLength={200}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) onUpdate({ title: v });
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
            />

            <div>
              <span className="label">Description</span>
              <textarea
                key={`desc:${textKey}`}
                className="input min-h-24 resize-y"
                placeholder="Add instructions, access notes, supplies needed…"
                defaultValue={task.description}
                onBlur={(e) => e.target.value !== task.description && onUpdate({ description: e.target.value })}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="label mb-0">Checklist</span>
                {items.length > 0 && (
                  <>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all"
                        style={{ width: `${(done / items.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted">
                      {done}/{items.length}
                    </span>
                  </>
                )}
              </div>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                    <button
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        item.done ? "border-success bg-success text-[#06231a]" : "border-white/30 hover:border-white/60"
                      }`}
                      onClick={() => props.onToggleChecklist(item)}
                      aria-label={item.done ? "Mark not done" : "Mark done"}
                    >
                      {item.done && <Check size={13} strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? "text-faint line-through" : ""}`}>{item.label}</span>
                    <button
                      className="text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger"
                      onClick={() => props.onDeleteChecklist(item.id)}
                      aria-label="Remove item"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newItem.trim()) props.onAddChecklist(newItem.trim());
                  setNewItem("");
                }}
              >
                <input
                  className="input"
                  placeholder="Add an item and press Enter"
                  value={newItem}
                  maxLength={200}
                  onChange={(e) => setNewItem(e.target.value)}
                />
              </form>
            </div>

            <TaskPhotos
              attachments={props.attachments}
              currentUserId={props.currentUserId}
              isManager={props.isManager}
              onAdd={props.onAddPhoto}
              onDelete={props.onDeletePhoto}
            />

            <div>
              <span className="label">Activity</span>
              <div className="flex gap-3">
                <Avatar profile={profileById.get(props.currentUserId)} size={30} />
                <div className="flex-1">
                  <textarea
                    className="input min-h-16 resize-none"
                    placeholder="Add a comment… (Ctrl+Enter to send)"
                    value={comment}
                    maxLength={2000}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && sendComment()}
                  />
                  <button className="btn btn-primary mt-2" onClick={sendComment} disabled={sending || !comment.trim()}>
                    <Send size={14} /> Comment
                  </button>
                </div>
              </div>
              <ul className="mt-5 space-y-4">
                {activity.map((entry) => {
                  if (entry.kind === "event") {
                    const e = entry.item;
                    const actor = e.actor_id ? profileById.get(e.actor_id) : undefined;
                    return (
                      <li key={`e:${e.id}`} className="flex items-center gap-3 pl-1.5 text-xs text-faint">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                        <span>
                          <span className="text-muted">{actor ? displayName(actor) : "Someone"}</span> {e.message} ·{" "}
                          {timeAgo(e.created_at)}
                        </span>
                      </li>
                    );
                  }
                  const c = entry.item;
                  const author = c.author_id ? profileById.get(c.author_id) : undefined;
                  return (
                    <li key={`c:${c.id}`} className="group pop-in flex gap-3">
                      <Avatar profile={author} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{displayName(author)}</span>
                          <span className="text-xs text-faint">{timeAgo(c.created_at)}</span>
                          {c.author_id === props.currentUserId && (
                            <button
                              className="ml-auto text-xs text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger focus:opacity-100"
                              onClick={() => confirm("Delete this comment?") && props.onDeleteComment(c.id)}
                            >
                              Delete
                            </button>
                          )}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{c.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <aside className="space-y-4">
            <Field label="Status">
              <select
                className="input"
                value={task.column_id}
                onChange={(e) => onUpdate({ column_id: e.target.value })}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Assignee">
              <select
                className="input"
                value={task.assignee_id ?? ""}
                onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {displayName(m.profile)}
                  </option>
                ))}
              </select>
            </Field>

            {fields.showPriority && (
              <Field label="Priority">
                <select
                  className="input"
                  value={task.priority}
                  onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
                  style={{ color: PRIORITIES[task.priority].color }}
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {fields.priorityLabels[p]}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Due date">
              <input
                type="date"
                className="input"
                value={task.due_date ?? ""}
                onChange={(e) => onUpdate({ due_date: e.target.value || null })}
              />
            </Field>

            {fields.showLocation && (
              <Field label={fields.locationLabel}>
                <div className="relative">
                  <MapPin size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
                  <input
                    key={`loc:${textKey}`}
                    className="input pl-8"
                    placeholder={fields.locationLabel === "Location" ? "Room, floor or area" : fields.locationLabel}
                    defaultValue={task.location}
                    maxLength={120}
                    onBlur={(e) => e.target.value !== task.location && onUpdate({ location: e.target.value })}
                  />
                </div>
              </Field>
            )}

            <p className="pt-2 text-xs text-faint">
              Created {timeAgo(task.created_at)}
              {task.created_by && profileById.get(task.created_by)
                ? ` by ${displayName(profileById.get(task.created_by))}`
                : ""}
              <br />
              Updated {timeAgo(task.updated_at)}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
