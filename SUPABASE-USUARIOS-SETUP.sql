-- IAFAS Intelligence Hub v4.2.142
-- Ejecutar en Supabase > SQL Editor del proyecto IAFAS Intelligence Hub.

create table if not exists public.hub_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  username text unique not null,
  display_name text not null,
  role text not null default 'Operativo',
  active boolean not null default true,
  allowed_modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hub_users enable row level security;

revoke all on table public.hub_users from anon;
revoke all on table public.hub_users from authenticated;

create index if not exists idx_hub_users_username
on public.hub_users (lower(username));

grant select, insert, update, delete on table public.hub_users to service_role;
