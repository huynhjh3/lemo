# Supabase setup for Lemo CRM

## 1. Create a project
1. Go to https://supabase.com and sign up / log in (free tier is enough).
2. **New project** → pick any name/region → set a database password (save it somewhere, you likely won't need it day-to-day).
3. Wait ~2 minutes for it to provision.

## 2. Run the schema
1. In the project, open **SQL Editor** → **New query**.
2. Paste in the contents of `supabase/schema.sql` (in this folder) and run it.
3. Confirm under **Table Editor** that `companies`, `outlets`, `chairs`, `usage_snapshots`, and `uploads` were created.

## 3. Get your API credentials
1. Go to **Project Settings** → **API**.
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`).
3. Copy the **anon / public** key (a long string — this is safe to put in frontend code, it's designed to be public and access is controlled by the row-level-security policies in `schema.sql`, not by keeping the key secret).

Send those two values back and the app will be wired up to use them — no other setup needed on your end.
