# delete-request Edge Function

Sends account deletion requests to contact@triagepaw.com via Resend.

## Where to add RESEND_API_KEY (Supabase Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. In the left sidebar, click **Edge Functions**.
3. Open the **Secrets** tab (or go to **Project Settings** → **Edge Functions** and use the Secrets section there).
   - Direct link: `https://supabase.com/dashboard/project/<YOUR_PROJECT_REF>/functions/secrets`
4. Add a new secret:
   - **Name:** `RESEND_API_KEY`
   - **Value:** your Resend API key (e.g. `re_xxxxxxxxx`)
5. Save. The function reads it via `Deno.env.get("RESEND_API_KEY")`.

You do not need to redeploy the function after adding or changing secrets.

## Deploy

From the project root (where `supabase` folder is):

```bash
supabase functions deploy delete-request
```

## Frontend

In `deletion.html`, set `SUPABASE_URL` to your project URL, e.g.:

```js
var SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
```

Find YOUR_PROJECT_REF in Dashboard → Project Settings → General → Reference ID.
