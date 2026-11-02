"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import SetupNotice from "@/components/SetupNotice";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The emailed link signs the visitor in with a short-lived recovery session.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) return <SetupNotice />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size={36} />
        </div>
        <div className="glass-strong pop-in rounded-3xl p-7 sm:p-8">
          <h1 className="text-xl font-semibold">Choose a new password</h1>
          {ready ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
              <button type="submit" className="btn btn-primary w-full py-2.5" disabled={busy}>
                {busy ? "Saving…" : "Save password and sign in"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Checking your reset link… If nothing happens, the link may have expired.{" "}
              <Link className="text-accent hover:underline" href="/login">
                Request a new one
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
