import type { Priority, Profile } from "./types";

/** localStorage key for the workspace the user last had open. */
export const WORKSPACE_KEY = "tyt.workspace";

export const PRIORITIES: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ff5c7a" },
  high: { label: "High", color: "#ff9f43" },
  medium: { label: "Medium", color: "#ffd166" },
  low: { label: "Low", color: "#5fd3a5" },
};

const AVATAR_COLOURS = ["#5b8cff", "#a66bff", "#ff6bb5", "#ff9f43", "#2ed3b7", "#4cc9f0", "#f72585"];

export function colourFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
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

export function keyPrefix(workspaceName?: string) {
  const letters = (workspaceName ?? "").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
  return letters.length >= 2 ? letters : "TYT";
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
