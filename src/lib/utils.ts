import type { CSSProperties } from "react";
import type { FieldConfig, Priority, Profile, Workspace } from "./types";

/** localStorage key for the workspace the user last had open. */
export const WORKSPACE_KEY = "tyt.workspace";
/** localStorage key for an invite code waiting for the visitor to sign in. */
export const PENDING_INVITE_KEY = "tyt.pendingInvite";
/** localStorage key for the board / my-work view choice. */
export const VIEW_KEY = "tyt.view";

/** Finished work stays on the board this long before it's archived. */
export const ARCHIVE_AFTER_DAYS = 7;

export function inviteLink(code: string) {
  return `${window.location.origin}/onboarding?code=${encodeURIComponent(code)}`;
}

export function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export const PRIORITIES: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ff5c7a" },
  high: { label: "High", color: "#ff9f43" },
  medium: { label: "Medium", color: "#ffd166" },
  low: { label: "Low", color: "#5fd3a5" },
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

/** Starting columns a new workspace can pick from. */
export const COLUMN_TEMPLATES = [
  { id: "simple", label: "Simple", columns: ["To do", "In progress", "Done"] },
  { id: "maintenance", label: "Maintenance", columns: ["Reported", "Assigned", "In progress", "Waiting on parts", "Done"] },
  { id: "housekeeping", label: "Housekeeping", columns: ["To clean", "Cleaning", "Inspect", "Ready"] },
  { id: "review", label: "With review", columns: ["Backlog", "To do", "In progress", "Review", "Done"] },
];

export const DEFAULT_ACCENT = "#6d8dff";
export const ACCENT_PRESETS = [DEFAULT_ACCENT, "#2ed3b7", "#5fd35f", "#ffb020", "#ff6b4a", "#ff4fa3", "#a66bff"];

export function fieldConfig(ws?: Workspace): FieldConfig {
  const labels = ws?.priority_labels ?? {};
  return {
    itemName: ws?.item_name || "job",
    itemNamePlural: ws?.item_name_plural || "jobs",
    showLocation: ws?.show_location ?? true,
    locationLabel: ws?.location_label || "Location",
    showPriority: ws?.show_priority ?? true,
    priorityLabels: {
      urgent: labels.urgent || PRIORITIES.urgent.label,
      high: labels.high || PRIORITIES.high.label,
      medium: labels.medium || PRIORITIES.medium.label,
      low: labels.low || PRIORITIES.low.label,
    },
  };
}

/** Overrides the theme accent for everything inside the element it's applied to. */
export function brandStyle(accent?: string | null): CSSProperties | undefined {
  if (!accent) return undefined;
  return {
    "--accent": accent,
    "--accent-2": `color-mix(in oklab, ${accent} 65%, white)`,
  } as CSSProperties;
}

/** A gradient picked from anywhere on the colour wheel, so people with the same initials still look different. */
export function avatarGradient(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue} 72% 56%), hsl(${(hue + 40) % 360} 72% 48%))`;
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function displayName(profile?: Profile | null) {
  if (!profile) return "Unassigned";
  return profile.full_name || profile.email || "Unknown";
}

export function initials(name: string) {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function byPosition<T extends { position: number }>(a: T, b: T) {
  return a.position - b.position;
}

/** A sort position between two neighbours, so a move only rewrites one row. */
export function positionBetween(prev?: number, next?: number) {
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined) return next! - 1;
  if (next === undefined) return prev + 1;
  return (prev + next) / 2;
}

export function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = { ...copy[i], ...item };
  return copy;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dueInfo(date: string | null) {
  if (!date) return null;
  const today = todayIso();
  const text = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (date < today) return { text, tone: "overdue" as const };
  if (date === today) return { text: "Today", tone: "soon" as const };
  return { text, tone: "normal" as const };
}

export function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
