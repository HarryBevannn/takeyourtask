"use client";

import { AlertTriangle, Bell, X } from "lucide-react";
import type { Toast } from "@/lib/types";

export default function Toasts({
  toasts,
  onDismiss,
  onOpenTask,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed top-20 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass-strong toast-in pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 ${
            t.taskId ? "cursor-pointer" : ""
          }`}
          onClick={() => {
            if (t.taskId) onOpenTask(t.taskId);
            onDismiss(t.id);
          }}
        >
          {t.kind === "error" ? (
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <Bell size={18} className="mt-0.5 shrink-0 text-accent" />
          )}
          <p className="flex-1 text-sm">{t.message}</p>
          <button
            className="text-faint hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(t.id);
            }}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
