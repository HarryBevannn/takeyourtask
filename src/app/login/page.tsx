"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import SetupNotice from "@/components/SetupNotice";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { PENDING_INVITE_KEY, readStorage } from "@/lib/utils";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!supabaseConfigured) return <SetupNotice />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) return setError(error.message);
      setNotice("If that email has an account, a link to set a new password is on its way.");
      return;
    }

    // Someone who arrived through an invite link goes back to finish joining.
    const next = readStorage(PENDING_INVITE_KEY) ? "/onboarding" : null;

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message);
      router.replace(next ?? "/");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) {
      router.replace(next ?? "/onboarding");
    } else {
      setNotice("Check your inbox to confirm your email, then sign in.");
      setMode("signin");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size={36} />
        </div>

        <div className="glass-strong pop-in rounded-3xl p-7 sm:p-8">
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "signin"
              ? "Sign in to see your team's board."
              : mode === "signup"
                ? "Set up your team's board in under a minute."
                : "We'll email you a link to choose a new one."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input
                  id="name"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="label" htmlFor="password">Password</label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
              </div>
            )}

            {error && <p className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
            {notice && <p className="rounded-xl bg-success/15 px-3 py-2 text-sm text-success">{notice}</p>}

            <button type="submit" className="btn btn-primary w-full py-2.5" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {mode === "signin" ? "New to TakeYourTask?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
