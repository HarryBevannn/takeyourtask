"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutGrid, UserPlus } from "lucide-react";
import Logo from "@/components/Logo";
import SetupNotice from "@/components/SetupNotice";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { COLUMN_TEMPLATES, PENDING_INVITE_KEY, WORKSPACE_KEY, readStorage, writeStorage } from "@/lib/utils";

export default function OnboardingPage() {
  if (!supabaseConfigured) return <SetupNotice />;
  // Reading the invite code from the URL happens in the browser, inside this boundary.
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const linkCode = params.get("code")?.trim().toUpperCase() ?? "";
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(COLUMN_TEMPLATES[0].id);
  const [code, setCode] = useState(() => linkCode || (typeof window === "undefined" ? "" : readStorage(PENDING_INVITE_KEY)) || "");
  const [hasWorkspaces, setHasWorkspaces] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Keep an invite code from a link safe while the visitor signs in or creates an account.
    if (linkCode) writeStorage(PENDING_INVITE_KEY, linkCode);
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace("/login");
      const { count } = await supabase
        .from("workspace_members")
        .select("workspace_id", { count: "exact", head: true })
        .eq("user_id", data.session.user.id);
      setHasWorkspaces((count ?? 0) > 0);
    });
  }, [router, linkCode]);

  const template = COLUMN_TEMPLATES.find((t) => t.id === templateId) ?? COLUMN_TEMPLATES[0];

  async function finish(rpc: "create_workspace" | "join_workspace", args: Record<string, string | string[]>) {
    setBusy(rpc === "create_workspace" ? "create" : "join");
    setError(null);
    const { data, error } = await supabase.rpc(rpc, args);
    setBusy(null);
    if (error) return setError(error.message);
    writeStorage(PENDING_INVITE_KEY, null);
    writeStorage(WORKSPACE_KEY, data as string);
    router.replace("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {hasWorkspaces && (
          <Link href="/" className="btn btn-ghost mb-4 text-muted">
            <ArrowLeft size={16} /> Back to my board
          </Link>
        )}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={36} />
          <h1 className="mt-4 text-2xl font-semibold">
            {linkCode ? "You've been invited to a team" : hasWorkspaces ? "Add another workspace" : "Get your team set up"}
          </h1>
          <p className="text-muted">
            {linkCode
              ? "Your invite code is filled in below. Press Join to get started."
              : "Start a new board for your team, or join one with an invite code."}
          </p>
        </div>

        {error && (
          <p className="mx-auto mb-4 max-w-md rounded-xl bg-danger/15 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        )}

        <div className={`grid gap-4 md:grid-cols-2 ${linkCode ? "md:[&>*:first-child]:order-2" : ""}`}>
          <form
            className="glass-strong pop-in rounded-3xl p-7"
            onSubmit={(e) => {
              e.preventDefault();
              finish("create_workspace", { ws_name: name, column_names: template.columns });
            }}
          >
            <LayoutGrid className="text-accent" size={26} />
            <h2 className="mt-4 text-lg font-semibold">Create a workspace</h2>
            <p className="mt-1 text-sm text-muted">You&apos;ll be the manager and can invite your team.</p>
            <label className="label mt-5" htmlFor="ws-name">Workspace name</label>
            <input
              id="ws-name"
              className="input"
              placeholder="e.g. Grand Hotel Housekeeping"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
            <span className="label mt-4">Starting columns</span>
            <div className="flex flex-wrap gap-1.5">
              {COLUMN_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn py-1 text-xs ${t.id === templateId ? "btn-primary" : ""}`}
                  aria-pressed={t.id === templateId}
                  onClick={() => setTemplateId(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">{template.columns.join(" → ")}</p>
            <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy !== null}>
              {busy === "create" ? "Creating…" : "Create workspace"}
            </button>
          </form>

          <form
            className={`glass-strong pop-in rounded-3xl p-7 ${linkCode ? "ring-2 ring-accent/60" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              finish("join_workspace", { code });
            }}
          >
            <UserPlus className="text-accent" size={26} />
            <h2 className="mt-4 text-lg font-semibold">Join your team</h2>
            <p className="mt-1 text-sm text-muted">Ask your manager for an invite link or the 8-character code.</p>
            <label className="label mt-5" htmlFor="code">Invite code</label>
            <input
              id="code"
              className="input font-mono uppercase tracking-widest"
              placeholder="AB12CD34"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={8}
              required
            />
            <button
              type="submit"
              className={`btn mt-4 w-full ${linkCode ? "btn-primary" : ""}`}
              disabled={busy !== null}
            >
              {busy === "join" ? "Joining…" : "Join workspace"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
