"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, UserPlus } from "lucide-react";
import Logo from "@/components/Logo";
import SetupNotice from "@/components/SetupNotice";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { WORKSPACE_KEY } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [router]);

  if (!supabaseConfigured) return <SetupNotice />;

  async function finish(rpc: "create_workspace" | "join_workspace", args: Record<string, string>) {
    setBusy(rpc === "create_workspace" ? "create" : "join");
    setError(null);
    const { data, error } = await supabase.rpc(rpc, args);
    setBusy(null);
    if (error) return setError(error.message);
    try {
      localStorage.setItem(WORKSPACE_KEY, data as string);
    } catch {}
    router.replace("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={36} />
          <h1 className="mt-4 text-2xl font-semibold">Get your team set up</h1>
          <p className="text-muted">Start a new board for your team, or join one with an invite code.</p>
        </div>

        {error && (
          <p className="mx-auto mb-4 max-w-md rounded-xl bg-danger/15 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <form
            className="glass-strong pop-in rounded-3xl p-7"
            onSubmit={(e) => {
              e.preventDefault();
              finish("create_workspace", { ws_name: name });
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
            <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy !== null}>
              {busy === "create" ? "Creating…" : "Create workspace"}
            </button>
          </form>

          <form
            className="glass-strong pop-in rounded-3xl p-7"
            onSubmit={(e) => {
              e.preventDefault();
              finish("join_workspace", { code });
            }}
          >
            <UserPlus className="text-accent" size={26} />
            <h2 className="mt-4 text-lg font-semibold">Join your team</h2>
            <p className="mt-1 text-sm text-muted">Ask your manager for the 8-character invite code.</p>
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
            <button type="submit" className="btn mt-4 w-full" disabled={busy !== null}>
              {busy === "join" ? "Joining…" : "Join workspace"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
