# TakeYourTask

A live task board for housekeeping and facilities teams. Managers create and assign jobs, staff
move them across the board, and everyone sees changes instantly.

- **Live board:** drag jobs between columns; every change appears on teammates' screens immediately
- **Notifications:** bell menu, pop-up toasts and desktop alerts when you're assigned a job, one of
  your jobs moves, or someone comments
- **Presence:** see who's online right now
- **Job cards:** location, assignee, priority, due date, checklist and comments
- **Workspaces:** each company gets its own private board; teammates join with an invite code
- **Roles:** managers create, delete and assign jobs and manage columns; staff update jobs

Built with Next.js, Supabase (Postgres, auth, realtime) and Tailwind CSS.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Create the database:** in the Supabase dashboard open **SQL Editor**, paste in
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. **Connect the app:** copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon (publishable) key from **Project Settings → API**.
4. **Run it:**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, create an account, then create a workspace.

Supabase asks new users to confirm their email by default. For quicker local testing you can turn
that off under **Authentication → Sign In / Providers → Email → Confirm email**.

## How it works

| Piece | Where |
|---|---|
| Tables, security rules, notification triggers | `supabase/schema.sql` |
| Board, live subscriptions, presence, notifications | `src/components/BoardApp.tsx` |
| Drag and drop | `src/components/Board.tsx` |
| Job detail panel | `src/components/TaskModal.tsx` |
| Liquid glass styles | `src/app/globals.css` |

Security is enforced in the database with row-level security, so a user can only ever read or
change data in workspaces they belong to, whatever the browser sends.
