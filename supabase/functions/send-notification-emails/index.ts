// Emails notifications people haven't seen in the app. Called every 5 minutes by pg_cron
// (see supabase/README.md). Does nothing until a RESEND_API_KEY secret is set.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Row {
  id: string;
  message: string;
  recipient: { email: string | null; full_name: string; email_notifications: boolean } | null;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await db.rpc("email_cron_secret_matches", { secret: req.headers.get("x-cron-secret") ?? "" });
  if (allowed !== true) return new Response("Forbidden", { status: 403 });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return Response.json({ skipped: "RESEND_API_KEY is not set" });
  const from = Deno.env.get("EMAIL_FROM") ?? "TakeYourTask <onboarding@resend.dev>";
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://takeyourtask-6x9k.netlify.app";

  // Unread for 2+ minutes means they didn't see it live; older than a day isn't worth emailing.
  const now = Date.now();
  const { data, error } = await db
    .from("notifications")
    .select("id, message, recipient:profiles!notifications_user_id_fkey(email, full_name, email_notifications)")
    .is("emailed_at", null)
    .eq("read", false)
    .lt("created_at", new Date(now - 2 * 60_000).toISOString())
    .gt("created_at", new Date(now - 24 * 3_600_000).toISOString())
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  const handled: string[] = [];
  for (const n of (data ?? []) as unknown as Row[]) {
    const to = n.recipient?.email;
    if (to && n.recipient?.email_notifications) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject: n.message,
          html: `<p>${escape(n.message)}</p><p><a href="${siteUrl}">Open TakeYourTask</a></p>
            <p style="color:#888;font-size:12px">You can turn these emails off from your profile in TakeYourTask.</p>`,
        }),
      });
      if (res.status === 429) break; // Rate limited: leave the rest for the next run.
      if (res.ok) sent += 1;
    }
    handled.push(n.id);
  }

  if (handled.length) await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", handled);
  return Response.json({ sent, handled: handled.length });
});
