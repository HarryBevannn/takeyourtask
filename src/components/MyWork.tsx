"use client";

import { TaskCardBody, type CardExtras } from "./TaskCard";
import type { Column, Task } from "@/lib/types";
import { capitalize } from "@/lib/utils";

interface MyWorkProps {
  tasks: Task[];
  columns: Column[];
  itemNamePlural: string;
  extrasFor: (task: Task) => CardExtras;
  onOpen: (id: string) => void;
}

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The signed-in person's unfinished work as one list, grouped by when it's due. */
export default function MyWork({ tasks, columns, itemNamePlural, extrasFor, onOpen }: MyWorkProps) {
  const today = isoDay(0);
  const tomorrow = isoDay(1);
  const weekEnd = isoDay(7);
  const columnName = new Map(columns.map((c) => [c.id, c.name]));

  const groups: { title: string; tone?: string; items: Task[] }[] = [
    { title: "Overdue", tone: "text-danger", items: [] },
    { title: "Today", tone: "text-[#ffd166]", items: [] },
    { title: "Tomorrow", items: [] },
    { title: "Next 7 days", items: [] },
    { title: "Later", items: [] },
    { title: "No due date", items: [] },
  ];
  for (const t of tasks) {
    const d = t.due_date;
    const i = !d ? 5 : d < today ? 0 : d === today ? 1 : d === tomorrow ? 2 : d <= weekEnd ? 3 : 4;
    groups[i].items.push(t);
  }
  for (const g of groups) g.items.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.number - b.number);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-start justify-center px-4 pt-10">
        <p className="glass rounded-2xl px-5 py-4 text-sm text-muted">
          Nothing on your plate. {capitalize(itemNamePlural)} assigned to you
          will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.title}>
              <h2 className={`mb-2 text-xs font-semibold tracking-[0.08em] uppercase ${g.tone ?? "text-muted"}`}>
                {g.title} <span className="text-faint">· {g.items.length}</span>
              </h2>
              <ul className="space-y-2.5">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <button className="block w-full text-left" onClick={() => onOpen(t.id)}>
                      <span className="mb-1 block text-[0.7rem] text-faint">{columnName.get(t.column_id)}</span>
                      <TaskCardBody task={t} extras={extrasFor(t)} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
