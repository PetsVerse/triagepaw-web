# delete-request Edge Function

Accepts account deletion requests from the **website form** (no login required). Inserts requests into the database and optionally notifies contact@triagepaw.com via Resend.

**No JWT or Authorization header is required** — the function is intended for unauthenticated visitors.

## Avoid 401 errors (allow anonymous invoke)

Supabase can require authentication to invoke Edge Functions. To allow website visitors to call this function without logging in:

1. In the [Supabase Dashboard](https://supabase.com/dashboard), open your project.
2. Go to **Edge Functions** → select **delete-request** (or **Authentication** / **Policies** depending on your dashboard).
3. Ensure the function is **invokable by anonymous users** (e.g. enable "Invoke" for anon role or disable "Enforce JWT" for this function).  
   Exact steps: **Project Settings** → **API** → under "Edge Functions" check that unauthenticated requests are allowed, or use **Database** → **Roles** so the anon role can invoke the function if your project uses that.

If you still get 401s, in Dashboard go to **Authentication** → **Policies** (or **Edge Functions** → function settings) and confirm that **anonymous** or **unauthenticated** access to invoke `delete-request` is enabled.

## Database table

The function inserts into `public.account_deletion_requests`. Create it once (e.g. run the migration):

```bash
supabase db push
```

Or run this SQL in the SQL Editor:

```sql
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  reason text,
  created_at timestamptz not null default now()
);
```

## Request body (JSON)

| Field   | Required | Description                |
|--------|----------|----------------------------|
| `email`| Yes      | Requester's email address. |
| `name` | No       | Requester's name.          |
| `reason`| No      | Optional reason or notes.  |

Example: `{ "email": "user@example.com", "name": "Jane", "reason": "No longer using the app" }`

## Secrets (Supabase Dashboard)

Set in **Edge Functions** → **Secrets** (or **Project Settings** → Edge Functions):

| Secret                         | Required | Description |
|--------------------------------|----------|-------------|
| `SUPABASE_URL`                 | Auto     | Set by Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY`    | Auto     | Set by Supabase. |
| `RESEND_API_KEY`               | No       | If set, an email is sent to contact@triagepaw.com. |
| `ALLOWED_ORIGIN` or `ALLOWED_ORIGINS` | No | CORS: single origin or comma-separated list (e.g. `https://triagepaw.com`, `https://www.triagepaw.com`). If unset, `*` is used. |

## CORS

The function sends `Access-Control-Allow-Origin` based on the request `Origin` header:

- If `ALLOWED_ORIGIN` or `ALLOWED_ORIGINS` is set, only those origins are allowed (or the first one if `Origin` does not match).
- If unset, `*` is used so any origin can call the function.

For production, set `ALLOWED_ORIGINS` to your site(s), e.g. `https://triagepaw.com,https://www.triagepaw.com`.

## Deploy

From the project root:

```bash
supabase functions deploy delete-request
```

## Frontend

In `deletion.html`, set the function URL. The script should POST JSON to the function URL with no `Authorization` header, e.g.:

```js
var SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
fetch(SUPABASE_URL + '/functions/v1/delete-request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: email, name: name, reason: reason })
});
```

Find YOUR_PROJECT_REF in Dashboard → Project Settings → General → Reference ID.
