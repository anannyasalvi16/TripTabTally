-- Migration 1: Schema, tables, triggers, and integrity constraints

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  upi_id text check (upi_id ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'),
  created_at timestamptz not null default now()
);

-- Automatic profile creation on auth sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Traveler'
  );

  insert into public.profiles (id, display_name)
  values (new.id, substring(raw_name from 1 for 60))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Trips
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  destination text check (char_length(destination) <= 80),
  start_date date,
  end_date date,
  currency char(3) not null default 'INR',
  budget_paise bigint check (budget_paise > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- 3. Trip Members
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id),
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('admin', 'member')),
  left_at timestamptz,
  joined_at timestamptz default now(),
  unique (trip_id, user_id)
);

-- 4. Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 1000000000),
  category text not null check (category in ('stay', 'food', 'transport', 'activities', 'shopping', 'other')),
  paid_by uuid not null references public.trip_members(id),
  spent_on date not null,
  note text check (char_length(note) <= 300),
  split_type text not null check (split_type in ('equal', 'exact', 'percent', 'shares')),
  split_input jsonb,
  created_by uuid not null references public.trip_members(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 5. Expense Splits
create table if not exists public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.trip_members(id),
  share_paise bigint not null check (share_paise >= 0),
  primary key (expense_id, member_id)
);

-- 6. Settlements
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member uuid not null references public.trip_members(id),
  to_member uuid not null references public.trip_members(id),
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_by uuid not null references public.trip_members(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  check (from_member <> to_member)
);

-- 7. Category Limits
create table if not exists public.category_limits (
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (category in ('stay', 'food', 'transport', 'activities', 'shopping', 'other')),
  limit_paise bigint not null check (limit_paise > 0),
  primary key (trip_id, category)
);

-- 8. Invites
create table if not exists public.invites (
  token text primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz
);

-- Indexes
create index if not exists idx_expenses_trip_spent on public.expenses (trip_id, spent_on desc) where deleted_at is null;
create index if not exists idx_expense_splits_member on public.expense_splits (member_id);
create index if not exists idx_settlements_trip on public.settlements (trip_id) where voided_at is null;
create index if not exists idx_trip_members_user on public.trip_members (user_id);
create index if not exists idx_invites_trip on public.invites (trip_id);

-- Version and timestamp trigger on expenses
create or replace function public.bump_expense_version()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bump_expense_version on public.expenses;
create trigger trg_bump_expense_version
  before update on public.expenses
  for each row execute function public.bump_expense_version();

-- Prevent deletion of member with active references
create or replace function public.check_member_references()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.expenses where (paid_by = old.id or created_by = old.id) and deleted_at is null) then
    raise exception 'Cannot delete member with active expenses. Mark as left instead.';
  end if;
  if exists (select 1 from public.expense_splits where member_id = old.id) then
    raise exception 'Cannot delete member with expense splits. Mark as left instead.';
  end if;
  if exists (select 1 from public.settlements where (from_member = old.id or to_member = old.id) and voided_at is null) then
    raise exception 'Cannot delete member with recorded settlements. Mark as left instead.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_check_member_references on public.trip_members;
create trigger trg_check_member_references
  before delete on public.trip_members
  for each row execute function public.check_member_references();

-- Ensure at least one admin remains per trip
create or replace function public.check_trip_admin_count()
returns trigger
language plpgsql
as $$
declare
  admin_count int;
begin
  select count(*) into admin_count
  from public.trip_members
  where trip_id = coalesce(new.trip_id, old.trip_id)
    and role = 'admin'
    and (left_at is null);

  if admin_count < 1 then
    raise exception 'A trip must have at least one active admin.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_check_trip_admin on public.trip_members;
create trigger trg_check_trip_admin
  after update or delete on public.trip_members
  for each row execute function public.check_trip_admin_count();
