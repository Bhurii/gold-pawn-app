create table if not exists public.action_audits (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('interest_payment', 'loan_transaction')),
  entity_id uuid not null,
  parent_type text not null check (parent_type in ('pawn', 'loan')),
  parent_id uuid not null,
  event_type text not null check (event_type in ('update', 'delete')),
  actor_user_key text not null check (actor_user_key in ('tony', 'louise', 'phat')),
  actor_display_name text not null,
  remark text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists action_audits_parent_idx
  on public.action_audits (parent_type, parent_id, created_at desc);

alter table public.action_audits enable row level security;

drop policy if exists "owners can manage action audits" on public.action_audits;
create policy "owners can manage action audits"
on public.action_audits for all
to authenticated
using (public.is_owner())
with check (public.is_owner());
