-- Run after the existing JARVIS PC bridge schema.
create table if not exists public.pc_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  device_id uuid references public.pc_devices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pc_pairing_requests_expiry_idx
  on public.pc_pairing_requests(expires_at);

alter table public.pc_pairing_requests enable row level security;
revoke all on public.pc_pairing_requests from anon, authenticated;
grant all on public.pc_pairing_requests to service_role;
