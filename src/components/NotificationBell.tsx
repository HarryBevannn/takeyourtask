"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import type { AppNotification } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export default function NotificationBell({
  notifications,
  desktopEnabled,
  onEnableDesktop,
  onOpen,
  onMarkAllRead,
}: {
  notifications: AppNotification[];
  desktopEnabled: boolean;
  onEnableDesktop: () => void;
  onOpen: (n: AppNotification) => void;
  onMarkAllRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost relative px-2.5"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        {unread ? <BellRing size={19} /> : <Bell size={19} />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-white ring-2 ring-[#11162e]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-strong pop-in bg-[#141a33]/95 fixed inset-x-3 top-20 z-50 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[380px] overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unread > 0 && (
              <button className="flex items-center gap-1 text-xs text-accent hover:underline" onClick={onMarkAllRead}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {!desktopEnabled && (
            <button
              className="w-full border-b border-white/10 bg-accent/10 px-4 py-2.5 text-left text-xs text-muted hover:bg-accent/20"
              onClick={onEnableDesktop}
            >
              <span className="font-medium text-foreground">Turn on desktop alerts</span> to get notified when this tab
              is in the background.
            </button>
          )}

          <ul className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-faint">You&apos;re all caught up.</li>
            )}
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                  onClick={() => {
                    onOpen(n);
                    setOpen(false);
                  }}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`}
                  />
                  <span className="flex-1">
                    <span className={`block text-sm ${n.read ? "text-muted" : ""}`}>{n.message}</span>
                    <span className="text-xs text-faint">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
