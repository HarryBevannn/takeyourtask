"use client";

import { useState } from "react";
import { Copy, Link2, LogOut, RefreshCw, UserMinus, X } from "lucide-react";
import Avatar from "./Avatar";
import type { Member, Role, Workspace } from "@/lib/types";
import { displayName, inviteLink } from "@/lib/utils";

interface TeamPanelProps {
  workspace: Workspace;
  members: Member[];
  currentUserId: string | null;
  isManager: boolean;
  online: Set<string>;
  onCopied: (what: string) => void;
  onNewCode: () => Promise<void>;
  onChangeRole: (userId: string, role: Role) => void;
  onRemove: (member: Member) => void;
  onLeave: () => void;
  onClose: () => void;
}

export default function TeamPanel(props: TeamPanelProps) {
  const { workspace, members, currentUserId, isManager, online } = props;
  const [renewing, setRenewing] = useState(false);
  const managers = members.filter((m) => m.role === "manager").length;
  const sorted = members
    .slice()
    .sort((a, b) => (a.role === b.role ? displayName(a.profile).localeCompare(displayName(b.profile)) : a.role === "manager" ? -1 : 1));

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text);
    props.onCopied(what);
  }

  return (
    <div className="glass-strong pop-in absolute right-0 z-50 mt-2 w-[min(92vw,380px)] rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Team · {members.length}</h3>
        <button className="text-faint hover:text-foreground" onClick={props.onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {isManager && (
        <div className="mt-3 rounded-xl bg-black/20 p-3">
          <p className="text-xs text-muted">Send teammates the invite link, or give them the code to enter.</p>
          <button
            className="btn btn-primary mt-2 w-full py-1.5"
            onClick={() => copy(inviteLink(workspace.invite_code), "Invite link copied")}
          >
            <Link2 size={14} /> Copy invite link
          </button>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 font-mono text-base tracking-[0.25em]">{workspace.invite_code}</code>
            <button className="btn px-2 py-1 text-xs" onClick={() => copy(workspace.invite_code, "Invite code copied")}>
              <Copy size={13} /> Code
            </button>
            <button
              className="btn px-2 py-1 text-xs"
              disabled={renewing}
              title="Make a new code. The old code and links stop working."
              onClick={async () => {
                if (!confirm("Make a new invite code? The current code and links will stop working.")) return;
                setRenewing(true);
                await props.onNewCode();
                setRenewing(false);
              }}
            >
              <RefreshCw size={13} className={renewing ? "animate-spin" : ""} /> New
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {sorted.map((m) => {
          const isMe = m.user_id === currentUserId;
          const lastManager = m.role === "manager" && managers === 1;
          return (
            <li key={m.user_id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
              <Avatar profile={m.profile} size={28} online={online.has(m.user_id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {displayName(m.profile)}
                  {isMe && <span className="text-faint"> (you)</span>}
                </span>
                {m.profile.full_name && m.profile.email && (
                  <span className="block truncate text-[0.7rem] text-faint">{m.profile.email}</span>
                )}
              </span>
              {isManager && !lastManager ? (
                <select
                  className="input w-auto py-1 text-xs"
                  value={m.role}
                  onChange={(e) => props.onChangeRole(m.user_id, e.target.value as Role)}
                  aria-label={`Role for ${displayName(m.profile)}`}
                >
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              ) : (
                <span className="text-xs text-faint capitalize">{m.role}</span>
              )}
              {isManager && !isMe && (
                <button
                  className="rounded-lg p-1 text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger focus:opacity-100"
                  onClick={() => props.onRemove(m)}
                  aria-label={`Remove ${displayName(m.profile)}`}
                  title="Remove from workspace"
                >
                  <UserMinus size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button className="btn btn-ghost mt-2 w-full justify-start text-xs text-muted hover:text-danger" onClick={props.onLeave}>
        <LogOut size={14} /> Leave this workspace
      </button>
    </div>
  );
}
