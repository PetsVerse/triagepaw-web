-- Table for website-originated account deletion requests (used by delete-request Edge Function).
-- The Edge Function uses the service role and does not require user JWT.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.account_deletion_requests is 'Stores account deletion requests from the public website form (delete-request Edge Function).';
