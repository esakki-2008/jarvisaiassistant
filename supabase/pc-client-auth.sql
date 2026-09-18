-- Add browser-scoped credential support to secure PC pairing.
alter table public.pc_pairing_requests
  add column if not exists client_token_hash text;

create index if not exists pc_pairing_requests_client_token_idx
  on public.pc_pairing_requests(client_token_hash);

-- Existing rows without a client token cannot be used for remote commands.
