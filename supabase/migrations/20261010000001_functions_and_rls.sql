-- Migration 2: Security definer functions, atomic operations, and RLS policies

-- Helper functions
create or replace function public.is_trip_member(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = t and user_id = auth.uid() and left_at is null
  );
$$;

create or replace function public.is_trip_admin(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = t and user_id = auth.uid() and role = 'admin' and left_at is null
  );
$$;

-- Atomic create_trip function
create or replace function public.create_trip(
  p_name text,
  p_destination text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_currency char(3) default 'INR',
  p_budget_paise bigint default null,
  p_display_name text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_trip_id uuid;
  v_display_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_display_name is not null and char_length(trim(p_display_name)) > 0 then
    v_display_name := trim(p_display_name);
  else
    select display_name into v_display_name from public.profiles where id = v_user_id;
  end if;

  if v_display_name is null then
    v_display_name := 'Admin';
  end if;

  insert into public.trips (
    name, destination, start_date, end_date, currency, budget_paise, created_by
  ) values (
    trim(p_name), p_destination, p_start_date, p_end_date, coalesce(p_currency, 'INR'), p_budget_paise, v_user_id
  ) returning id into v_trip_id;

  insert into public.trip_members (
    trip_id, user_id, display_name, role, joined_at
  ) values (
    v_trip_id, v_user_id, v_display_name, 'admin', now()
  );

  return v_trip_id;
end;
$$;

-- Join trip function with placeholder claim support
create or replace function public.join_trip(
  p_token text,
  p_claim_member_id uuid default null,
  p_display_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_invite record;
  v_existing_member record;
  v_target_member record;
  v_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_invite from public.invites where token = p_token;
  if not found then
    raise exception 'This invite link is no longer active.';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'This invite link has been revoked.';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'This invite link has expired.';
  end if;

  select * into v_existing_member from public.trip_members
  where trip_id = v_invite.trip_id and user_id = v_user_id;

  if found then
    return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', v_existing_member.id);
  end if;

  if p_claim_member_id is not null then
    select * into v_target_member from public.trip_members
    where id = p_claim_member_id and trip_id = v_invite.trip_id;

    if not found then
      raise exception 'Member to claim was not found in this trip.';
    end if;

    if v_target_member.user_id is not null then
      raise exception 'This person has already been claimed.';
    end if;

    update public.trip_members
    set user_id = v_user_id,
        display_name = coalesce(nullif(trim(p_display_name), ''), v_target_member.display_name),
        joined_at = now()
    where id = p_claim_member_id;

    return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', p_claim_member_id);
  else
    if p_display_name is not null and char_length(trim(p_display_name)) > 0 then
      v_name := trim(p_display_name);
    else
      select display_name into v_name from public.profiles where id = v_user_id;
    end if;

    if v_name is null then
      v_name := 'Member';
    end if;

    insert into public.trip_members (trip_id, user_id, display_name, role, joined_at)
    values (v_invite.trip_id, v_user_id, v_name, 'member', now())
    returning id into p_claim_member_id;

    return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', p_claim_member_id);
  end if;
end;
$$;

-- Atomic save_expense function (insert or update with version check)
create or replace function public.save_expense(
  p_expense_id uuid,
  p_trip_id uuid,
  p_title text,
  p_amount_paise bigint,
  p_category text,
  p_paid_by uuid,
  p_spent_on date,
  p_note text,
  p_split_type text,
  p_split_input jsonb,
  p_splits jsonb, -- array of { member_id: uuid, share_paise: bigint }
  p_expected_version int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_creator_member_id uuid;
  v_res_expense_id uuid;
  v_split record;
  v_sum_paise bigint := 0;
  v_current_version int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select id into v_creator_member_id
  from public.trip_members
  where trip_id = p_trip_id and user_id = v_user_id and left_at is null;

  if v_creator_member_id is null then
    raise exception 'You must be an active trip member.';
  end if;

  -- Validate split sum
  for v_split in select * from jsonb_to_recordset(p_splits) as x(member_id uuid, share_paise bigint)
  loop
    v_sum_paise := v_sum_paise + v_split.share_paise;
  end loop;

  if v_sum_paise <> p_amount_paise then
    raise exception 'Splits sum (%) does not equal total amount (%).', v_sum_paise, p_amount_paise;
  end if;

  if p_expense_id is null then
    -- Insert
    insert into public.expenses (
      trip_id, title, amount_paise, category, paid_by, spent_on, note,
      split_type, split_input, created_by, version
    ) values (
      p_trip_id, trim(p_title), p_amount_paise, p_category, p_paid_by, p_spent_on,
      p_note, p_split_type, p_split_input, v_creator_member_id, 1
    ) returning id into v_res_expense_id;
  else
    -- Update with optimistic version check
    select version into v_current_version from public.expenses where id = p_expense_id and trip_id = p_trip_id;
    if not found then
      raise exception 'Expense not found.';
    end if;

    if p_expected_version is not null and v_current_version <> p_expected_version then
      return jsonb_build_object('ok', false, 'conflict', true, 'current_version', v_current_version);
    end if;

    update public.expenses
    set title = trim(p_title),
        amount_paise = p_amount_paise,
        category = p_category,
        paid_by = p_paid_by,
        spent_on = p_spent_on,
        note = p_note,
        split_type = p_split_type,
        split_input = p_split_input
    where id = p_expense_id and trip_id = p_trip_id
    returning id into v_res_expense_id;

    delete from public.expense_splits where expense_id = v_res_expense_id;
  end if;

  -- Insert splits
  for v_split in select * from jsonb_to_recordset(p_splits) as x(member_id uuid, share_paise bigint)
  loop
    insert into public.expense_splits (expense_id, member_id, share_paise)
    values (v_res_expense_id, v_split.member_id, v_split.share_paise);
  end loop;

  return jsonb_build_object('ok', true, 'expense_id', v_res_expense_id);
end;
$$;

-- ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.category_limits enable row level security;
alter table public.invites enable row level security;

-- PROFILES POLICIES
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.trip_members tm1
      join public.trip_members tm2 on tm1.trip_id = tm2.trip_id
      where tm1.user_id = auth.uid() and tm2.user_id = profiles.id
    )
  );

create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- TRIPS POLICIES
create policy "trips_select_member" on public.trips
  for select using (public.is_trip_member(id));

create policy "trips_insert_auth" on public.trips
  for insert with check (auth.uid() is not null);

create policy "trips_update_admin" on public.trips
  for update using (public.is_trip_admin(id));

-- TRIP MEMBERS POLICIES
create policy "trip_members_select_member" on public.trip_members
  for select using (public.is_trip_member(trip_id));

create policy "trip_members_insert_placeholder" on public.trip_members
  for insert with check (
    public.is_trip_member(trip_id) and user_id is null
  );

create policy "trip_members_update_admin_or_self" on public.trip_members
  for update using (
    public.is_trip_admin(trip_id) or user_id = auth.uid()
  );

-- EXPENSES POLICIES
create policy "expenses_select_member" on public.expenses
  for select using (public.is_trip_member(trip_id));

create policy "expenses_insert_member" on public.expenses
  for insert with check (public.is_trip_member(trip_id));

create policy "expenses_update_creator_or_admin" on public.expenses
  for update using (
    public.is_trip_admin(trip_id)
    or exists (
      select 1 from public.trip_members
      where id = expenses.created_by and user_id = auth.uid()
    )
  );

-- EXPENSE SPLITS POLICIES
create policy "expense_splits_select_member" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

create policy "expense_splits_insert_member" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

create policy "expense_splits_update_member" on public.expense_splits
  for update using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

create policy "expense_splits_delete_member" on public.expense_splits
  for delete using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

-- SETTLEMENTS POLICIES
create policy "settlements_select_member" on public.settlements
  for select using (public.is_trip_member(trip_id));

create policy "settlements_insert_participant_or_admin" on public.settlements
  for insert with check (
    public.is_trip_admin(trip_id)
    or exists (
      select 1 from public.trip_members
      where id in (from_member, to_member) and user_id = auth.uid()
    )
  );

create policy "settlements_update_creator_or_admin" on public.settlements
  for update using (
    public.is_trip_admin(trip_id)
    or exists (
      select 1 from public.trip_members
      where id = settlements.created_by and user_id = auth.uid()
    )
  );

-- CATEGORY LIMITS POLICIES
create policy "category_limits_select_member" on public.category_limits
  for select using (public.is_trip_member(trip_id));

create policy "category_limits_admin_insert" on public.category_limits
  for insert with check (public.is_trip_admin(trip_id));

create policy "category_limits_admin_update" on public.category_limits
  for update using (public.is_trip_admin(trip_id));

create policy "category_limits_admin_delete" on public.category_limits
  for delete using (public.is_trip_admin(trip_id));

-- INVITES POLICIES
create policy "invites_select_admin" on public.invites
  for select using (public.is_trip_admin(trip_id));

create policy "invites_insert_admin" on public.invites
  for insert with check (public.is_trip_admin(trip_id));

create policy "invites_update_admin" on public.invites
  for update using (public.is_trip_admin(trip_id));
