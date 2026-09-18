-- Mobile companion schema
create table if not exists public.mobile_devices (
  id uuid primary key default gen_random_uuid(), device_name text not null, device_token_hash text not null unique,
  platform text not null default 'android', created_at timestamptz not null default now(), last_seen_at timestamptz,
  paired_at timestamptz not null default now(), enabled boolean not null default true
);
create table if not exists public.mobile_commands (
  id uuid primary key default gen_random_uuid(), device_id uuid not null references public.mobile_devices(id) on delete cascade,
  action text not null, value text, status text not null default 'queued' check (status in ('queued','claimed','completed','failed','cancelled')),
  result text, created_at timestamptz not null default now(), claimed_at timestamptz, completed_at timestamptz
);
create table if not exists public.mobile_pairing_requests (
  id uuid primary key default gen_random_uuid(), code_hash text not null, client_token_hash text, expires_at timestamptz not null,
  used boolean not null default false, used_at timestamptz, device_id uuid references public.mobile_devices(id) on delete set null, created_at timestamptz not null default now()
);
alter table public.mobile_devices enable row level security;
alter table public.mobile_commands enable row level security;
alter table public.mobile_pairing_requests enable row level security;
revoke all on public.mobile_devices from anon, authenticated;
revoke all on public.mobile_commands from anon, authenticated;
revoke all on public.mobile_pairing_requests from anon, authenticated;
grant usage on schema public to service_role;
grant all on public.mobile_devices to service_role;
grant all on public.mobile_commands to service_role;
grant all on public.mobile_pairing_requests to service_role;

-- Cloud memory for the JARVIS Android companion.
create table if not exists public.mobile_memory (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.mobile_devices(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists mobile_memory_device_created_idx
  on public.mobile_memory(device_id, created_at desc);
alter table public.mobile_memory enable row level security;
revoke all on public.mobile_memory from anon, authenticated;
grant all on public.mobile_memory to service_role;
