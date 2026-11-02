"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, X } from "lucide-react";
import type { Priority, Workspace, WorkspaceSettings as Settings } from "@/lib/types";
import { ACCENT_PRESETS, DEFAULT_ACCENT, PRIORITIES, PRIORITY_ORDER, brandStyle, fieldConfig } from "@/lib/utils";

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => Promise<boolean>;
  onUploadLogo: (file: File) => Promise<string | null>;
}

const MAX_LOGO_BYTES = 1024 * 1024;

export default function WorkspaceSettings({ workspace, onClose, onSave, onUploadLogo }: WorkspaceSettingsProps) {
  const fields = fieldConfig(workspace);
  const [name, setName] = useState(workspace.name);
  const [keyPrefix, setKeyPrefix] = useState(workspace.key_prefix ?? "TYT");
  const [itemName, setItemName] = useState(fields.itemName);
  const [itemNamePlural, setItemNamePlural] = useState(fields.itemNamePlural);
  const [logoUrl, setLogoUrl] = useState(workspace.logo_url);
  const [accent, setAccent] = useState(workspace.accent_color);
  const [showLocation, setShowLocation] = useState(fields.showLocation);
  const [locationLabel, setLocationLabel] = useState(fields.locationLabel);
  const [showPriority, setShowPriority] = useState(fields.showPriority);
  const [priorityLabels, setPriorityLabels] = useState(fields.priorityLabels);
  const [defaultPriority, setDefaultPriority] = useState(workspace.default_priority ?? "medium");
  const [staffCreate, setStaffCreate] = useState(workspace.staff_can_create_tasks ?? false);
  const [staffDelete, setStaffDelete] = useState(workspace.staff_can_delete_tasks ?? false);
  const [staffColumns, setStaffColumns] = useState(workspace.staff_can_manage_columns ?? false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Logos must be PNG, JPEG or WebP.");
    if (file.size > MAX_LOGO_BYTES) return setError("Logos must be 1 MB or smaller.");
    setError(null);
    setUploading(true);
    const url = await onUploadLogo(file);
    setUploading(false);
    if (url) setLogoUrl(url);
  }

  async function save() {
    if (!name.trim()) return setError("The workspace needs a name.");
    if (!/^[A-Z]{2,5}$/.test(keyPrefix)) return setError("The ID prefix must be 2 to 5 letters.");
    setError(null);
    setSaving(true);
    // Only store labels that differ from the defaults, so blank fields fall back cleanly.
    const labels: Partial<Record<Priority, string>> = {};
    for (const p of PRIORITY_ORDER) {
      const v = priorityLabels[p].trim();
      if (v && v !== PRIORITIES[p].label) labels[p] = v;
    }
    const ok = await onSave({
      name: name.trim(),
      key_prefix: keyPrefix,
      item_name: itemName.trim().toLowerCase() || "job",
      item_name_plural: itemNamePlural.trim().toLowerCase() || "jobs",
      logo_url: logoUrl,
      accent_color: accent,
      show_location: showLocation,
      location_label: locationLabel.trim() || "Location",
      show_priority: showPriority,
      priority_labels: labels,
      default_priority: defaultPriority,
      staff_can_create_tasks: staffCreate,
      staff_can_delete_tasks: staffDelete,
      staff_can_manage_columns: staffColumns,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Workspace settings"
        className="glass-strong pop-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
        style={brandStyle(accent)}
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold">Workspace settings</h2>
          <button className="btn btn-ghost ml-auto px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <Section title="Company">
            <label className="label" htmlFor="ws-settings-name">Workspace name</label>
            <input
              id="ws-settings-name"
              className="input"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr_1fr]">
              <div>
                <label className="label" htmlFor="ws-settings-prefix">ID prefix</label>
                <input
                  id="ws-settings-prefix"
                  className="input font-mono tracking-widest uppercase"
                  value={keyPrefix}
                  maxLength={5}
                  onChange={(e) => setKeyPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                />
              </div>
              <div>
                <label className="label" htmlFor="ws-settings-item">Call each one a</label>
                <input
                  id="ws-settings-item"
                  className="input"
                  placeholder="job"
                  value={itemName}
                  maxLength={20}
                  onChange={(e) => setItemName(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="ws-settings-items">Plural</label>
                <input
                  id="ws-settings-items"
                  className="input"
                  placeholder="jobs"
                  value={itemNamePlural}
                  maxLength={20}
                  onChange={(e) => setItemNamePlural(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-faint">
              IDs look like {keyPrefix || "TYT"}-12.
              {keyPrefix !== workspace.key_prefix && " Changing the prefix changes the ID of every existing one."} The
              board will say “Create {itemName.trim().toLowerCase() || "job"}”, “Search{" "}
              {itemNamePlural.trim().toLowerCase() || "jobs"}” and so on.
            </p>
          </Section>

          <Section title="Branding" hint="Shown to everyone in this workspace.">
            <span className="label">Logo</span>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/25 ring-1 ring-white/15">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImagePlus size={20} className="text-faint" />
                )}
              </div>
              <button className="btn" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : logoUrl ? "Replace" : "Upload"}
              </button>
              {logoUrl && (
                <button className="btn btn-ghost text-muted" onClick={() => setLogoUrl(null)}>
                  Remove
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  pickLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-faint">PNG, JPEG or WebP, up to 1 MB. A square image works best.</p>

            <span className="label mt-5">Accent colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => {
                const selected = (accent ?? DEFAULT_ACCENT).toLowerCase() === c;
                return (
                  <button
                    key={c}
                    className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-white/30 transition hover:scale-110"
                    style={{ background: c }}
                    onClick={() => setAccent(c === DEFAULT_ACCENT ? null : c)}
                    aria-label={`Use ${c}`}
                    aria-pressed={selected}
                  >
                    {selected && <Check size={15} strokeWidth={3} className="text-white drop-shadow" />}
                  </button>
                );
              })}
              <label className="btn ml-1 cursor-pointer py-1.5 text-xs">
                Custom
                <input
                  type="color"
                  className="h-5 w-6 cursor-pointer border-none bg-transparent p-0"
                  value={accent ?? DEFAULT_ACCENT}
                  onChange={(e) => setAccent(e.target.value)}
                />
              </label>
            </div>
          </Section>

          <Section title="Task fields" hint="Rename or hide the optional fields on each task.">
            <Toggle checked={showLocation} onChange={setShowLocation} label="Show the location field" />
            {showLocation && (
              <div className="mt-2 pl-12">
                <label className="label" htmlFor="ws-settings-location">Call it</label>
                <input
                  id="ws-settings-location"
                  className="input max-w-xs"
                  placeholder="Location"
                  value={locationLabel}
                  maxLength={30}
                  onChange={(e) => setLocationLabel(e.target.value)}
                />
                <p className="mt-1 text-xs text-faint">For example Room, Site, Unit or Address.</p>
              </div>
            )}

            <div className="mt-4">
              <Toggle checked={showPriority} onChange={setShowPriority} label="Show priority" />
            </div>
            {showPriority && (
              <div className="mt-2 grid gap-2 pl-12 sm:grid-cols-2">
                {PRIORITY_ORDER.map((p) => (
                  <div key={p} className="relative">
                    <span
                      className="absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                      style={{ background: PRIORITIES[p].color }}
                    />
                    <input
                      className="input pl-8"
                      placeholder={PRIORITIES[p].label}
                      value={priorityLabels[p]}
                      maxLength={20}
                      aria-label={`Name for ${PRIORITIES[p].label} priority`}
                      onChange={(e) => setPriorityLabels((l) => ({ ...l, [p]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Permissions" hint="Managers can always do all of these.">
            <div className="space-y-3">
              <Toggle checked={staffCreate} onChange={setStaffCreate} label="Staff can create tasks" />
              <Toggle checked={staffDelete} onChange={setStaffDelete} label="Staff can delete tasks" />
              <Toggle checked={staffColumns} onChange={setStaffColumns} label="Staff can add, rename and delete columns" />
            </div>
          </Section>

          <Section title="Board defaults">
            {showPriority && (
              <>
                <label className="label" htmlFor="ws-settings-priority">Priority for new tasks</label>
                <select
                  id="ws-settings-priority"
                  className="input max-w-xs"
                  value={defaultPriority}
                  onChange={(e) => setDefaultPriority(e.target.value as Priority)}
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabels[p].trim() || PRIORITIES[p].label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <p className="mt-3 text-xs text-faint">
              To change the board&apos;s columns, double-click a column title to rename it, or use “Add column” at the end of
              the board.
            </p>
          </Section>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4 pb-16 sm:pb-4">
          {error && <p className="w-full text-sm text-danger sm:w-auto">{error}</p>}
          <button className="btn btn-ghost flex-1 sm:ml-auto sm:flex-none" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary flex-1 sm:flex-none" onClick={save} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
      {label}
    </label>
  );
}
