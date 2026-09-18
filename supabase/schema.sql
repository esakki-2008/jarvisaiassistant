-- JARVIS secure remote PC bridge
-- Run this entire file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.pc_devices (
  id uuid primary key default gen_random_uuid(),
  device_name text not null,
  device_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  paired_at timestamptz not null default now(),
  enabled boolean not null default true
);

create table if not exists public.pc_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.pc_devices(id) on delete cascade,
  action text not null,
  value text,
  status text not null default 'queued'
    check (status in ('queued','claimed','completed','failed','cancelled')),
  result text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists pc_commands_device_status_idx
  on public.pc_commands(device_id, status, created_at);

create index if not exists pc_devices_enabled_idx
  on public.pc_devices(enabled);

alter table public.pc_devices enable row level security;
alter table public.pc_commands enable row level security;

-- No public policies are created intentionally.
-- Browser clients must never receive service-role access.
-- Server-side Vercel functions will use the Supabase service role.

revoke all on public.pc_devices from anon, authenticated;
revoke all on public.pc_commands from anon, authenticated;

grant usage on schema public to service_role;
grant all on public.pc_devices to service_role;
grant all on public.pc_commands to service_role;


create table if not exists public.pc_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  client_token_hash text,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  device_id uuid references public.pc_devices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pc_pairing_requests_expiry_idx
  on public.pc_pairing_requests(expires_at);

create index if not exists pc_pairing_requests_client_token_idx
  on public.pc_pairing_requests(client_token_hash);

alter table public.pc_pairing_requests enable row level security;
revoke all on public.pc_pairing_requests from anon, authenticated;
grant all on public.pc_pairing_requests to service_role;

-- Browser cloud memory. The browser stores only an opaque client token; the server stores its SHA-256 hash.
create table if not exists public.web_memory (
  id uuid primary key default gen_random_uuid(),
  client_token_hash text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists web_memory_client_created_idx
  on public.web_memory(client_token_hash, created_at desc);
alter table public.web_memory enable row level security;
revoke all on public.web_memory from anon, authenticated;
grant all on public.web_memory to service_role;
