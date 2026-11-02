"use client";

import { useEffect, useState } from "react";
import { LogOut, X } from "lucide-react";
import Avatar from "./Avatar";
import type { Profile } from "@/lib/types";

interface ProfileDialogProps {
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Pick<Profile, "full_name" | "email_notifications">) => Promise<boolean>;
  onSignOut: () => void;
}

export default function ProfileDialog({ profile, onClose, onSave, onSignOut }: ProfileDialogProps) {
  const [name, setName] = useState(profile.full_name);
  const [emails, setEmails] = useState(profile.email_notifications ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({ full_name: name.trim(), email_notifications: emails });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal
        aria-label="Your profile"
        onSubmit={save}
        className="glass-strong pop-in w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <Avatar profile={{ ...profile, full_name: name }} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Your profile</h2>
            <p className="truncate text-xs text-faint">{profile.email}</p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="label mt-6" htmlFor="profile-name">Display name</label>
        <input
          id="profile-name"
          className="input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="How your team sees you"
        />
        <p className="mt-1 text-xs text-faint">Use your full name so teammates with the same initials can tell you apart.</p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            checked={emails}
            onChange={(e) => setEmails(e.target.checked)}
          />
          <span>
            Email me about things I miss
            <span className="block text-xs text-faint">
              Assignments, comments and due-tomorrow reminders you haven&apos;t seen in the app within a few minutes.
            </span>
          </span>
        </label>

        <div className="mt-6 flex items-center gap-2 pb-12 sm:pb-0">
          <button type="button" className="btn btn-ghost px-2.5 text-muted hover:text-danger" onClick={onSignOut}>
            <LogOut size={15} /> Sign out
          </button>
          <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
