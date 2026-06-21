alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('owner', 'agent', 'viewer'));

alter table public.pawns
  add column if not exists fund_owner text not null default 'tony';

alter table public.loans
  add column if not exists fund_owner text not null default 'tony';

alter table public.pawns
  drop constraint if exists pawns_fund_owner_check;

alter table public.pawns
  add constraint pawns_fund_owner_check
  check (fund_owner in ('tony', 'louise', 'phat'));

alter table public.loans
  drop constraint if exists loans_fund_owner_check;

alter table public.loans
  add constraint loans_fund_owner_check
  check (fund_owner in ('tony', 'louise', 'phat'));

update public.pawns
set fund_owner = 'tony'
where fund_owner is null or fund_owner not in ('tony', 'louise', 'phat');

update public.loans
set fund_owner = 'tony'
where fund_owner is null or fund_owner not in ('tony', 'louise', 'phat');

create index if not exists pawns_fund_owner_idx on public.pawns (fund_owner, created_at desc);
create index if not exists loans_fund_owner_idx on public.loans (fund_owner, created_at desc);
