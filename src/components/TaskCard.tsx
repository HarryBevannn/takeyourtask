"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, ListChecks, MapPin } from "lucide-react";
import Avatar from "./Avatar";
import type { Profile, Task } from "@/lib/types";
import { PRIORITIES, dueInfo } from "@/lib/utils";

export interface CardExtras {
  prefix: string;
  assignee?: Profile;
  assigneeOnline?: boolean;
  checklist?: { done: number; total: number };
}

export function TaskCardBody({ task, extras, lifted }: { task: Task; extras: CardExtras; lifted?: boolean }) {
  const due = dueInfo(task.due_date);
  const priority = PRIORITIES[task.priority];
  const checklist = extras.checklist;

  return (
    <div
      className={`glass-card relative overflow-hidden rounded-2xl p-3.5 pl-4 ${
        lifted ? "rotate-2 scale-[1.03] shadow-2xl" : ""
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: priority.color }} />
      <p className="text-[0.9rem] leading-snug font-medium">{task.title}</p>

      {task.location && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
          <MapPin size={12} /> {task.location}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="font-mono text-[0.7rem] tracking-wide text-faint">
          {extras.prefix}-{task.number}
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold"
          style={{ background: `${priority.color}22`, color: priority.color }}
        >
          {priority.label}
        </span>
        {checklist && checklist.total > 0 && (
          <span
            className={`flex items-center gap-1 ${checklist.done === checklist.total ? "text-success" : ""}`}
          >
            <ListChecks size={13} /> {checklist.done}/{checklist.total}
          </span>
        )}
        {due && (
          <span
            className={`flex items-center gap-1 ${
              due.tone === "overdue" ? "text-danger" : due.tone === "soon" ? "text-[#ffd166]" : ""
            }`}
          >
            <CalendarDays size={12} /> {due.text}
          </span>
        )}
        <span className="ml-auto">
          <Avatar profile={extras.assignee} size={24} online={extras.assigneeOnline} />
        </span>
      </div>
    </div>
  );
}

export default function TaskCard({
  task,
  extras,
  onOpen,
}: {
  task: Task;
  extras: CardExtras;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`touch-manipulation outline-none ${isDragging ? "opacity-30" : ""}`}
      onClick={() => onOpen(task.id)}
      {...attributes}
      {...listeners}
    >
      <TaskCardBody task={task} extras={extras} />
    </div>
  );
}
