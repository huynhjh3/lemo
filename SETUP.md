# LemoCRM setup

This app is a static React SPA that talks directly to Supabase (Postgres + Auth). Account creation is **owner-invited-only** via the Supabase dashboard — there's no self-signup or in-app invite flow.

## 1. Run the database schema

In the Supabase dashboard → SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). This creates all tables (`profiles`, `companies`, `contacts`, `outlets`, `devices`, `activity_log`, `notes`, `tasks`, `revenue_entries`) and their RLS policies.

## 2. Configure local env vars

Copy the example file and fill in your project's values (Supabase dashboard → Project Settings → API):

```bash
cp .env.local.example .env.local
```

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`.env.local` is already gitignored (via the `*.local` rule) — never commit it.

## 3. Bootstrap the first owner account

Account creation is owner-invited-only from inside the app, so the very first user has a chicken-and-egg problem — you can't invite yourself before you can sign in. To fix that:

1. Supabase dashboard → Authentication → Users → **Add user**, create yourself with an email + password.
2. In the SQL Editor, run:
   ```sql
   insert into profiles (id, name, role)
   values ('<the user id from the Users page>', 'Justin', 'owner');
   ```

## 4. Add a BD consultant or company partner later

Same two steps as above.

A **BD consultant** (internal, full access — same two-step flow, `role = 'bd_consultant'`):

```sql
insert into profiles (id, name, role)
values ('<user id>', 'Rep Name', 'bd_consultant');
```

A **company partner** (external client login, sees only their own company's revenue/contacts/outlets/devices — also set `company_id` to that company's `id`):

```sql
insert into profiles (id, name, role, company_id)
values ('<user id>', 'Partner Name', 'partner', '<company id>');
```

## 5. Run it locally

```bash
npm install
npm run dev
```

## 6. Production (GitHub Pages)

The build bakes `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in at build time (the anon key is safe to expose publicly — RLS is what actually protects the data). Add them as repo secrets so the deploy workflow can use them:

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys to GitHub Pages automatically.
