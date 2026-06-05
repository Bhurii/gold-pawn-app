-- Baseline schema for Gold Pawn App.
-- Review and apply to a preview Supabase project before production.

create extension if not exists "pgcrypto";

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  invest_budget numeric(14,2) not null default 0 check (invest_budget >= 0),
  agent_pin text,
  agent_pin_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'agent')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.pawns (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null,
  pawn_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  pawn_slip_url text,
  status text not null default 'active' check (status in ('active', 'redeemed')),
  tx_status text not null default 'pending_transfer' check (tx_status in ('pending_transfer', 'active', 'pending_redeem', 'redeemed')),
  notes text,
  renewed_from_id uuid references public.pawns(id) on delete set null,
  renewal_interest numeric(14,2) not null default 0 check (renewal_interest >= 0),
  -- Positive means principal was paid down. Negative means principal was topped up.
  renewal_principal_paid numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pawns_ticket_no_unique on public.pawns (ticket_no);
create index if not exists pawns_status_idx on public.pawns (status, tx_status);
create index if not exists pawns_created_at_idx on public.pawns (created_at desc);

create table if not exists public.interest_payments (
  id uuid primary key default gen_random_uuid(),
  pawn_id uuid not null references public.pawns(id) on delete cascade,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  slip_url text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists interest_payments_pawn_date_idx on public.interest_payments (pawn_id, payment_date);

create table if not exists public.transfer_slips (
  id uuid primary key default gen_random_uuid(),
  pawn_id uuid not null references public.pawns(id) on delete cascade,
  direction text not null check (direction in ('me_to_mom', 'mom_to_me')),
  slip_url text,
  amount numeric(14,2) check (amount is null or amount >= 0),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists transfer_slips_pawn_idx on public.transfer_slips (pawn_id, created_at);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  pawn_id uuid not null references public.pawns(id) on delete cascade,
  redeem_date date not null,
  interest_last numeric(14,2) not null default 0 check (interest_last >= 0),
  interest_total numeric(14,2) not null default 0 check (interest_total >= 0),
  total_return numeric(14,2) not null default 0 check (total_return >= 0),
  pawn_slip_url text,
  transfer_slip_url text,
  status text not null default 'pending_confirm' check (status in ('pending_confirm', 'confirmed')),
  created_at timestamptz not null default now()
);

create index if not exists redemptions_pawn_idx on public.redemptions (pawn_id);
create index if not exists redemptions_status_idx on public.redemptions (status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  message text not null,
  is_read boolean not null default false,
  pawn_id uuid references public.pawns(id) on delete set null,
  action_url text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_unread_idx on public.notifications (is_read, created_at desc);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  borrower_name text not null,
  start_date date not null,
  principal numeric(14,2) not null check (principal > 0),
  remaining_principal numeric(14,2) not null check (remaining_principal >= 0),
  interest_rate numeric(8,4) not null default 0 check (interest_rate >= 0),
  notes text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_status_idx on public.loans (status, created_at desc);

create table if not exists public.loan_transactions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  type text not null check (type in ('principal', 'interest', 'principal_payment', 'close')),
  amount numeric(14,2) not null check (amount >= 0),
  transaction_date date not null,
  slip_url text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists loan_transactions_loan_date_idx on public.loan_transactions (loan_id, transaction_date);
create index if not exists loan_transactions_type_date_idx on public.loan_transactions (type, transaction_date);

create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  amount numeric(14,2) not null check (amount > 0),
  income_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists other_income_date_idx on public.other_income (income_date desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
before update on public.settings
for each row execute function public.touch_updated_at();

drop trigger if exists pawns_touch_updated_at on public.pawns;
create trigger pawns_touch_updated_at
before update on public.pawns
for each row execute function public.touch_updated_at();

drop trigger if exists loans_touch_updated_at on public.loans;
create trigger loans_touch_updated_at
before update on public.loans
for each row execute function public.touch_updated_at();

insert into public.settings (invest_budget)
select 0
where not exists (select 1 from public.settings);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

alter table public.settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.pawns enable row level security;
alter table public.interest_payments enable row level security;
alter table public.transfer_slips enable row level security;
alter table public.redemptions enable row level security;
alter table public.notifications enable row level security;
alter table public.loans enable row level security;
alter table public.loan_transactions enable row level security;
alter table public.other_income enable row level security;

-- Preview policies. These are intentionally owner-only for writes.
-- Agent writes should be moved to server routes/RPC before production.

drop policy if exists "owners can read settings" on public.settings;
create policy "owners can read settings"
on public.settings for select
to authenticated
using (public.is_owner());

drop policy if exists "owners can update settings" on public.settings;
create policy "owners can update settings"
on public.settings for update
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can read roles" on public.user_roles;
create policy "owners can read roles"
on public.user_roles for select
to authenticated
using (public.is_owner() or user_id = auth.uid());

drop policy if exists "owners can manage roles" on public.user_roles;
create policy "owners can manage roles"
on public.user_roles for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage pawns" on public.pawns;
create policy "owners can manage pawns"
on public.pawns for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage interest payments" on public.interest_payments;
create policy "owners can manage interest payments"
on public.interest_payments for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage transfer slips" on public.transfer_slips;
create policy "owners can manage transfer slips"
on public.transfer_slips for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage redemptions" on public.redemptions;
create policy "owners can manage redemptions"
on public.redemptions for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage notifications" on public.notifications;
create policy "owners can manage notifications"
on public.notifications for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage loans" on public.loans;
create policy "owners can manage loans"
on public.loans for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage loan transactions" on public.loan_transactions;
create policy "owners can manage loan transactions"
on public.loan_transactions for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "owners can manage other income" on public.other_income;
create policy "owners can manage other income"
on public.other_income for all
to authenticated
using (public.is_owner())
with check (public.is_owner());
