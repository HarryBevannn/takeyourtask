# Database setup

## Fresh Supabase project

In the SQL Editor, run these in order:

1. `schema.sql` (tables, security rules, settings and task ID prefixes)
2. `migrations/20261102c_team_activity_photos_reminders.sql`
3. `migrations/20261102d_email_schedule.sql` (change the project URL inside it to your own project first)

Skip `20261102_workspace_settings.sql` and `20261102b_task_keys_and_terminology.sql`. They are already part of `schema.sql`.

Then deploy the email function in `functions/send-notification-emails`, with JWT verification turned off. The function checks its own secret.

## Auth settings (Dashboard → Authentication)

- **URL Configuration:** set Site URL to the live site, and add `https://<your-site>/**` and `http://localhost:3123/**` to Redirect URLs. Password-reset links only work for addresses on that list.
- **Emails → SMTP:** add a custom sender, such as Resend or Postmark. Without one, Supabase only sends auth emails (password resets, confirmations) to members of your Supabase team, a few per hour.

## Email notifications

pg_cron calls `send-notification-emails` every 5 minutes. The function emails unread notifications that are 2 minutes to 24 hours old to people who left "Email me" switched on in their profile.

It does nothing until it has an API key:

1. Create a free account at resend.com, verify your domain, and create an API key.
2. In Dashboard → Edge Functions → Secrets, add:
   - `RESEND_API_KEY`: the key
   - `EMAIL_FROM`: for example `TakeYourTask <tasks@yourdomain.com>` (must be on the verified domain)
   - `SITE_URL`: the live site address, used for the link in each email

Due-tomorrow reminders are created every day at 07:00 UTC, whether or not email is set up. They appear in the app's notification bell.
