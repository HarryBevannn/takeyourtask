"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import TaskCard, { TaskCardBody, type CardExtras } from "./TaskCard";
import type { Column, Task } from "@/lib/types";
import { byPosition, positionBetween } from "@/lib/utils";

interface BoardProps {
  columns: Column[];
  tasks: Task[];
  canCreate: boolean;
  canManageColumns: boolean;
  /** The last column, where finished work lands. */
  doneColumnId?: string;
  itemName: string;
  extrasFor: (task: Task) => CardExtras;
  onOpen: (id: string) => void;
  onMove: (id: string, columnId: string, position: number) => void;
  onCreate: (columnId: string, title: string) => Promise<void>;
  onAddColumn: (name: string) => Promise<void>;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string) => void;
}

interface DragState {
  tasks: Task[];
  activeId: string;
  origin: { columnId: string; position: number };
}

const COLUMN_PREFIX = "col:";

function columnOf(id: string, list: Task[]) {
  if (id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length);
  return list.find((t) => t.id === id)?.column_id;
}

export default function Board(props: BoardProps) {
  const { columns, tasks, canManageColumns, extrasFor, onMove } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // While dragging, the board renders from a private copy so live updates can't yank cards around.
  const [drag, setDrag] = useState<DragState | null>(null);
  const view = drag?.tasks ?? tasks;

  const byColumn = useMemo(() => {
    const map = new Map<string, Task[]>(columns.map((c) => [c.id, []]));
    for (const t of view) map.get(t.column_id)?.push(t);
    for (const list of map.values()) list.sort(byPosition);
    return map;
  }, [columns, view]);

  const activeTask = drag ? view.find((t) => t.id === drag.activeId) : undefined;

  function handleDragStart(e: DragStartEvent) {
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task) return;
    setDrag({ tasks, activeId: task.id, origin: { columnId: task.column_id, position: task.position } });
  }

  // Moving across columns: re-home the card as soon as it hovers a new column.
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    setDrag((d) => {
      if (!d) return d;
      const card = d.tasks.find((t) => t.id === active.id);
      const target = columnOf(String(over.id), d.tasks);
      if (!card || !target || card.column_id === target) return d;

      const others = d.tasks.filter((t) => t.column_id === target && t.id !== card.id).sort(byPosition);
      let position: number;
      if (String(over.id).startsWith(COLUMN_PREFIX)) {
        position = positionBetween(others.at(-1)?.position, undefined);
      } else {
        const i = others.findIndex((t) => t.id === over.id);
        position = positionBetween(others[i - 1]?.position, others[i]?.position);
      }
      return {
        ...d,
        tasks: d.tasks.map((t) => (t.id === card.id ? { ...t, column_id: target, position } : t)),
      };
    });
  }

  // Dropping: settle the final order within the column, then save one row.
  function handleDragEnd(e: DragEndEvent) {
    const d = drag;
    setDrag(null);
    const { active, over } = e;
    if (!d || !over) return;

    let card = d.tasks.find((t) => t.id === active.id);
    if (!card) return;

    if (!String(over.id).startsWith(COLUMN_PREFIX) && over.id !== active.id) {
      const col = d.tasks.filter((t) => t.column_id === card!.column_id).sort(byPosition);
      const from = col.findIndex((t) => t.id === card!.id);
      const to = col.findIndex((t) => t.id === over.id);
      if (from !== -1 && to !== -1) {
        const moved = arrayMove(col, from, to);
        const i = moved.findIndex((t) => t.id === card!.id);
        card = { ...card, position: positionBetween(moved[i - 1]?.position, moved[i + 1]?.position) };
      }
    }

    if (card.column_id !== d.origin.columnId || card.position !== d.origin.position) {
      onMove(card.id, card.column_id, card.position);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <div className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6">
        {columns.map((col) => (
          <BoardColumn key={col.id} {...props} column={col} tasks={byColumn.get(col.id) ?? []} />
        ))}
        {canManageColumns && <AddColumn onAdd={props.onAddColumn} />}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
        {activeTask ? <TaskCardBody task={activeTask} extras={extrasFor(activeTask)} lifted /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  tasks,
  canCreate,
  canManageColumns,
  doneColumnId,
  itemName,
  extrasFor,
  onOpen,
  onCreate,
  onRenameColumn,
  onDeleteColumn,
}: BoardProps & { column: Column }) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_PREFIX + column.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  async function submit() {
    const value = title.trim();
    if (!value) return setAdding(false);
    setTitle("");
    await onCreate(column.id, value);
  }

  return (
    <section
      className={`glass flex max-h-full w-[85vw] max-w-[320px] shrink-0 snap-center flex-col rounded-3xl transition-colors sm:w-[320px] ${
        isOver ? "ring-2 ring-accent/50" : ""
      }`}
    >
      <header className="group flex items-center gap-2 px-4 pt-4 pb-3">
        {renaming ? (
          <input
            autoFocus
            className="input py-1 text-sm"
            defaultValue={column.name}
            maxLength={40}
            onBlur={(e) => {
              setRenaming(false);
              const v = e.target.value.trim();
              if (v && v !== column.name) onRenameColumn(column.id, v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <h2
            className="text-xs font-semibold tracking-[0.08em] text-muted uppercase"
            onDoubleClick={() => canManageColumns && setRenaming(true)}
            title={canManageColumns ? "Double-click to rename" : undefined}
          >
            {column.name}
          </h2>
        )}
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
            column.id === doneColumnId ? "bg-success/15 text-success" : "bg-white/10 text-muted"
          }`}
        >
          {column.id === doneColumnId && <CheckCircle2 size={11} strokeWidth={2.5} />}
          {tasks.length}
        </span>
        {canManageColumns && tasks.length === 0 && !renaming && (
          <button
            className="ml-auto rounded-lg p-1 text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger"
            onClick={() => onDeleteColumn(column.id)}
            aria-label={`Delete column ${column.name}`}
          >
            <Trash2 size={14} />
          </button>
        )}
      </header>

      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} extras={extrasFor(task)} onOpen={onOpen} />
          ))}
        </SortableContext>

        {canCreate &&
          (adding ? (
            <div className="glass-card rounded-2xl p-2">
              <textarea
                autoFocus
                rows={2}
                className="input resize-none border-none bg-transparent focus:shadow-none"
                placeholder="What needs doing?"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={submit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                  if (e.key === "Escape") {
                    setTitle("");
                    setAdding(false);
                  }
                }}
              />
            </div>
          ) : (
            <button className="btn btn-ghost justify-start text-muted" onClick={() => setAdding(true)}>
              <Plus size={16} /> Create {itemName}
            </button>
          ))}
      </div>
    </section>
  );
}

function AddColumn({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!editing) {
    return (
      <button
        className="glass flex h-14 w-[260px] shrink-0 snap-center items-center justify-center gap-2 rounded-3xl text-sm text-muted transition hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <Plus size={16} /> Add column
      </button>
    );
  }

  return (
    <form
      className="glass h-fit w-[260px] shrink-0 rounded-3xl p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim()) await onAdd(name.trim());
        setName("");
        setEditing(false);
      }}
    >
      <input
        autoFocus
        className="input"
        placeholder="Column name"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      />
      <div className="mt-2 flex gap-2">
        <button type="submit" className="btn btn-primary flex-1">Add</button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  );
}
