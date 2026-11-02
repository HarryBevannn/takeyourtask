export default function SetupNotice() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="glass-strong pop-in w-full max-w-lg rounded-3xl p-8">
        <h1 className="text-2xl font-semibold">Connect Supabase to start</h1>
        <p className="mt-3 text-muted">
          TakeYourTask needs a Supabase project for logins, data and live updates.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Create a free project at supabase.com.</li>
          <li>
            Open <b className="text-foreground">SQL Editor</b>, paste in{" "}
            <code className="font-mono text-foreground">supabase/schema.sql</code> and run it.
          </li>
          <li>
            Copy <code className="font-mono text-foreground">.env.local.example</code> to{" "}
            <code className="font-mono text-foreground">.env.local</code> and fill in your project URL
            and anon key.
          </li>
          <li>Restart the dev server.</li>
        </ol>
      </div>
    </main>
  );
}
