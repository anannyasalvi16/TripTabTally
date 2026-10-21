-- ==============================================================================
-- TripTabTally: Master Supabase Reset & Schema Setup Script
-- ==============================================================================
-- This script completely wipes all existing TripTabTally tables, triggers,
-- functions, and policies in public schema, then cleanly rebuilds the entire
-- production schema, constraints, triggers, RPC functions, and RLS policies.
--
-- How to run:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project -> Go to SQL Editor.
-- 3. Paste this entire file into a new query and click "Run".
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLEAN SLATE: DROP EXISTING TABLES, FUNCTIONS, AND TRIGGERS
-- ------------------------------------------------------------------------------

-- Drop auth trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop all public tables with CASCADE
DROP TABLE IF EXISTS public.due_reminders CASCADE;
DROP TABLE IF EXISTS public.category_limits CASCADE;
DROP TABLE IF EXISTS public.settlements CASCADE;
DROP TABLE IF EXISTS public.expense_splits CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.recurring_rules CASCADE;
DROP TABLE IF EXISTS public.invites CASCADE;
DROP TABLE IF EXISTS public.trip_members CASCADE;
DROP TABLE IF EXISTS public.trip_families CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all custom functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.bump_expense_version() CASCADE;
DROP FUNCTION IF EXISTS public.check_member_references() CASCADE;
DROP FUNCTION IF EXISTS public.check_trip_admin_count() CASCADE;
DROP FUNCTION IF EXISTS public.validate_trip_dates() CASCADE;
DROP FUNCTION IF EXISTS public.validate_expense_date() CASCADE;
DROP FUNCTION IF EXISTS public.is_trip_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_trip_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_trip(text, text, date, date, char, bigint, text) CASCADE;
DROP FUNCTION IF EXISTS public.join_trip(text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.save_expense(uuid, uuid, text, bigint, text, uuid, date, text, text, jsonb, jsonb, int) CASCADE;

-- ------------------------------------------------------------------------------
-- 2. CREATE CORE TABLES & CONSTRAINTS
-- ------------------------------------------------------------------------------

-- 2.1 Profiles (links to Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  upi_id TEXT CHECK (upi_id ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2.2 Trips
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  destination TEXT CHECK (char_length(destination) <= 80),
  start_date DATE,
  end_date DATE,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  budget_paise BIGINT CHECK (budget_paise > 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  archived_at TIMESTAMPTZ,
  CONSTRAINT trips_dates_order_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT trips_start_date_year_check CHECK (start_date IS NULL OR (extract(year from start_date) BETWEEN 1000 AND 9999)),
  CONSTRAINT trips_end_date_year_check CHECK (end_date IS NULL OR (extract(year from end_date) BETWEEN 1000 AND 9999))
);

-- 2.3 Trip Families
CREATE TABLE public.trip_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (trip_id, name)
);

-- 2.4 Trip Members (supports registered users & manual placeholders)
CREATE TABLE public.trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  family_id UUID REFERENCES public.trip_families(id) ON DELETE SET NULL,
  email TEXT CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone TEXT,
  left_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE (trip_id, user_id)
);

-- 2.5 Category Limits
CREATE TABLE public.category_limits (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('stay', 'food', 'transport', 'activities', 'shopping', 'other')),
  limit_paise BIGINT NOT NULL CHECK (limit_paise > 0),
  PRIMARY KEY (trip_id, category)
);

-- 2.6 Invites
CREATE TABLE public.invites (
  token TEXT PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ, -- null indicates non-expiring link
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2.7 Recurring Rules
CREATE TABLE public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'custom')),
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days >= 1 AND interval_days <= 365),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  created_by UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  stopped_at TIMESTAMPTZ
);

-- 2.8 Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  category TEXT NOT NULL CHECK (category IN ('stay', 'food', 'transport', 'activities', 'shopping', 'other')),
  paid_by UUID NOT NULL REFERENCES public.trip_members(id),
  spent_on DATE NOT NULL CHECK (extract(year from spent_on) BETWEEN 1000 AND 9999),
  note TEXT CHECK (char_length(note) <= 300),
  split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percent', 'shares', 'family')),
  split_input JSONB,
  created_by UUID NOT NULL REFERENCES public.trip_members(id),
  recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL,
  recurring_sequence INTEGER,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 2.9 Expense Splits
CREATE TABLE public.expense_splits (
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.trip_members(id),
  share_paise BIGINT NOT NULL CHECK (share_paise >= 0),
  PRIMARY KEY (expense_id, member_id)
);

-- 2.10 Settlements
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES public.trip_members(id),
  to_member UUID NOT NULL REFERENCES public.trip_members(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT CHECK (char_length(note) <= 200),
  created_by UUID NOT NULL REFERENCES public.trip_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  voided_at TIMESTAMPTZ,
  CONSTRAINT settlements_different_members_check CHECK (from_member <> to_member)
);

-- 2.11 Due Reminders
CREATE TABLE public.due_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  to_member UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  channel TEXT NOT NULL DEFAULT 'share' CHECK (channel IN ('whatsapp', 'sms', 'copy', 'share')),
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- ------------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX idx_expenses_trip_spent ON public.expenses (trip_id, spent_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_recurring_rule_id ON public.expenses(recurring_rule_id);
CREATE INDEX idx_expense_splits_member ON public.expense_splits (member_id);
CREATE INDEX idx_settlements_trip ON public.settlements (trip_id) WHERE voided_at IS NULL;
CREATE INDEX idx_trip_members_user ON public.trip_members (user_id);
CREATE INDEX idx_trip_members_trip ON public.trip_members (trip_id);
CREATE INDEX idx_trip_families_trip ON public.trip_families (trip_id);
CREATE INDEX idx_invites_trip ON public.invites (trip_id);
CREATE INDEX idx_recurring_rules_trip_id ON public.recurring_rules (trip_id);
CREATE INDEX idx_due_reminders_trip ON public.due_reminders (trip_id);
CREATE INDEX idx_due_reminders_rate_limit ON public.due_reminders (trip_id, from_member, reminded_at DESC);

-- ------------------------------------------------------------------------------
-- 4. DATABASE TRIGGERS
-- ------------------------------------------------------------------------------

-- 4.1 Auto-profile creation on auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_name TEXT;
BEGIN
  raw_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Traveler'
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, substring(raw_name FROM 1 FOR 60))
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name
    WHERE public.profiles.display_name IS NULL OR public.profiles.display_name = 'Traveler';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync any existing auth.users directly into public.profiles
INSERT INTO public.profiles (id, display_name)
SELECT
  id,
  substring(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'Traveler') FROM 1 FOR 60)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4.2 Optimistic locking version bump on expenses
CREATE OR REPLACE FUNCTION public.bump_expense_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_expense_version ON public.expenses;
CREATE TRIGGER trg_bump_expense_version
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.bump_expense_version();

-- 4.3 Prevent deletion of member with active references
CREATE OR REPLACE FUNCTION public.check_member_references()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.expenses WHERE (paid_by = OLD.id OR created_by = OLD.id) AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Cannot delete member with active expenses. Mark as left instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.expense_splits WHERE member_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete member with expense splits. Mark as left instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.settlements WHERE (from_member = OLD.id OR to_member = OLD.id) AND voided_at IS NULL) THEN
    RAISE EXCEPTION 'Cannot delete member with recorded settlements. Mark as left instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_member_references ON public.trip_members;
CREATE TRIGGER trg_check_member_references
  BEFORE DELETE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.check_member_references();

-- 4.4 Ensure at least one admin remains per trip
CREATE OR REPLACE FUNCTION public.check_trip_admin_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_count INT;
BEGIN
  SELECT count(*) INTO admin_count
  FROM public.trip_members
  WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
    AND role = 'admin'
    AND left_at IS NULL;

  IF admin_count < 1 THEN
    RAISE EXCEPTION 'A trip must have at least one active admin.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_check_trip_admin ON public.trip_members;
CREATE TRIGGER trg_check_trip_admin
  AFTER UPDATE OR DELETE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.check_trip_admin_count();

-- 4.5 Validate trip dates (start/end logic and window limits)
CREATE OR REPLACE FUNCTION public.validate_trip_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  min_date DATE := (CURRENT_DATE - INTERVAL '1 year')::DATE;
  max_date DATE := (CURRENT_DATE + INTERVAL '5 years')::DATE;
BEGIN
  IF NEW.start_date IS NOT NULL THEN
    IF NEW.start_date < min_date OR NEW.start_date > max_date THEN
      RAISE EXCEPTION 'Trip start date must be between % and %.', min_date, max_date
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.end_date IS NOT NULL THEN
    IF NEW.end_date < min_date OR NEW.end_date > max_date THEN
      RAISE EXCEPTION 'Trip end date must be between % and %.', min_date, max_date
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    IF NEW.end_date < NEW.start_date THEN
      RAISE EXCEPTION 'End date cannot be earlier than start date.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_trip_dates ON public.trips;
CREATE TRIGGER trg_validate_trip_dates
  BEFORE INSERT OR UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.validate_trip_dates();

-- 4.6 Validate expense dates within trip bounds
CREATE OR REPLACE FUNCTION public.validate_expense_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_start DATE;
  v_trip_end DATE;
  min_date DATE := (CURRENT_DATE - INTERVAL '1 year')::DATE;
  max_date DATE := (CURRENT_DATE + INTERVAL '5 years')::DATE;
BEGIN
  SELECT start_date, end_date INTO v_trip_start, v_trip_end
  FROM public.trips
  WHERE id = NEW.trip_id;

  IF v_trip_start IS NOT NULL AND v_trip_end IS NOT NULL THEN
    IF NEW.spent_on < v_trip_start OR NEW.spent_on > v_trip_end THEN
      IF v_trip_start = v_trip_end THEN
        RAISE EXCEPTION 'Expense date must be %.', v_trip_start
          USING ERRCODE = 'check_violation';
      ELSE
        RAISE EXCEPTION 'Expense date must be between % and %.', v_trip_start, v_trip_end
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  ELSIF v_trip_start IS NOT NULL AND v_trip_end IS NULL THEN
    IF NEW.spent_on < v_trip_start THEN
      RAISE EXCEPTION 'Expense date must be on or after %.', v_trip_start
        USING ERRCODE = 'check_violation';
    ELSIF NEW.spent_on > max_date THEN
      RAISE EXCEPTION 'Expense date cannot be more than 5 years in the future (%).', max_date
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF v_trip_start IS NULL AND v_trip_end IS NOT NULL THEN
    IF NEW.spent_on > v_trip_end THEN
      RAISE EXCEPTION 'Expense date must be on or before %.', v_trip_end
        USING ERRCODE = 'check_violation';
    ELSIF NEW.spent_on < min_date THEN
      RAISE EXCEPTION 'Expense date cannot be earlier than 1 year in the past (%).', min_date
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.spent_on < min_date OR NEW.spent_on > max_date THEN
      RAISE EXCEPTION 'Expense date must be between % and %.', min_date, max_date
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_expense_date ON public.expenses;
CREATE TRIGGER trg_validate_expense_date
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_date();

-- ------------------------------------------------------------------------------
-- 5. RPC FUNCTIONS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- 5.1 Helper: Check if current user is active trip member
CREATE OR REPLACE FUNCTION public.is_trip_member(t UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = t AND user_id = auth.uid() AND left_at IS NULL
  );
$$;

-- 5.2 Helper: Check if current user is active trip admin
CREATE OR REPLACE FUNCTION public.is_trip_admin(t UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = t AND user_id = auth.uid() AND role = 'admin' AND left_at IS NULL
  );
$$;

-- 5.3 Atomic create_trip function
CREATE OR REPLACE FUNCTION public.create_trip(
  p_name TEXT,
  p_destination TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_currency CHAR(3) DEFAULT 'INR',
  p_budget_paise BIGINT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_trip_id UUID;
  v_display_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_display_name IS NOT NULL AND char_length(trim(p_display_name)) > 0 THEN
    v_display_name := trim(p_display_name);
  ELSE
    SELECT display_name INTO v_display_name FROM public.profiles WHERE id = v_user_id;
  END IF;

  IF v_display_name IS NULL THEN
    v_display_name := 'Admin';
  END IF;

  INSERT INTO public.trips (
    name, destination, start_date, end_date, currency, budget_paise, created_by
  ) VALUES (
    trim(p_name), p_destination, p_start_date, p_end_date, COALESCE(p_currency, 'INR'), p_budget_paise, v_user_id
  ) RETURNING id INTO v_trip_id;

  INSERT INTO public.trip_members (
    trip_id, user_id, display_name, role, joined_at
  ) VALUES (
    v_trip_id, v_user_id, v_display_name, 'admin', timezone('utc', now())
  );

  RETURN v_trip_id;
END;
$$;

-- 5.4 Join trip function (supports placeholder claiming & auto-linking)
CREATE OR REPLACE FUNCTION public.join_trip(
  p_token TEXT,
  p_claim_member_id UUID DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_email TEXT;
  v_existing_member RECORD;
  v_target_member RECORD;
  v_matched_member RECORD;
  v_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite link is no longer active.';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite link has been revoked.';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < timezone('utc', now()) THEN
    RAISE EXCEPTION 'This invite link has expired.';
  END IF;

  -- 1. Check if user is already an active member of this trip
  SELECT * INTO v_existing_member FROM public.trip_members
  WHERE trip_id = v_invite.trip_id AND user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', v_existing_member.id);
  END IF;

  -- 2. If claiming a specific placeholder member
  IF p_claim_member_id IS NOT NULL THEN
    SELECT * INTO v_target_member FROM public.trip_members
    WHERE id = p_claim_member_id AND trip_id = v_invite.trip_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Member to claim was not found in this trip.';
    END IF;

    IF v_target_member.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'This person has already been claimed.';
    END IF;

    UPDATE public.trip_members
    SET user_id = v_user_id,
        display_name = COALESCE(NULLIF(trim(p_display_name), ''), v_target_member.display_name),
        email = COALESCE(email, v_user_email),
        joined_at = timezone('utc', now())
    WHERE id = p_claim_member_id;

    RETURN jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', p_claim_member_id);
  END IF;

  -- 3. Auto-link if an unclaimed member matches user's email
  IF v_user_email IS NOT NULL AND char_length(trim(v_user_email)) > 0 THEN
    SELECT * INTO v_matched_member FROM public.trip_members
    WHERE trip_id = v_invite.trip_id
      AND user_id IS NULL
      AND lower(trim(email)) = lower(trim(v_user_email))
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.trip_members
      SET user_id = v_user_id,
          display_name = COALESCE(NULLIF(trim(p_display_name), ''), v_matched_member.display_name),
          joined_at = timezone('utc', now())
      WHERE id = v_matched_member.id;

      RETURN jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', v_matched_member.id);
    END IF;
  END IF;

  -- 4. Otherwise create a new member row
  IF p_display_name IS NOT NULL AND char_length(trim(p_display_name)) > 0 THEN
    v_name := trim(p_display_name);
  ELSE
    SELECT display_name INTO v_name FROM public.profiles WHERE id = v_user_id;
  END IF;

  IF v_name IS NULL THEN
    v_name := 'Member';
  END IF;

  INSERT INTO public.trip_members (trip_id, user_id, display_name, email, role, joined_at)
  VALUES (v_invite.trip_id, v_user_id, v_name, v_user_email, 'member', timezone('utc', now()))
  RETURNING id INTO p_claim_member_id;

  RETURN jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', p_claim_member_id);
END;
$$;

-- 5.5 Atomic save_expense function (handles version check & split insertion)
CREATE OR REPLACE FUNCTION public.save_expense(
  p_expense_id UUID,
  p_trip_id UUID,
  p_title TEXT,
  p_amount_paise BIGINT,
  p_category TEXT,
  p_paid_by UUID,
  p_spent_on DATE,
  p_note TEXT,
  p_split_type TEXT,
  p_split_input JSONB,
  p_splits JSONB, -- array of { member_id: uuid, share_paise: bigint }
  p_expected_version INT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_creator_member_id UUID;
  v_res_expense_id UUID;
  v_split RECORD;
  v_sum_paise BIGINT := 0;
  v_current_version INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT id INTO v_creator_member_id
  FROM public.trip_members
  WHERE trip_id = p_trip_id AND user_id = v_user_id AND left_at IS NULL;

  IF v_creator_member_id IS NULL THEN
    RAISE EXCEPTION 'You must be an active trip member.';
  END IF;

  -- Validate split sum
  FOR v_split IN SELECT * FROM jsonb_to_recordset(p_splits) AS x(member_id UUID, share_paise BIGINT)
  LOOP
    v_sum_paise := v_sum_paise + v_split.share_paise;
  END LOOP;

  IF v_sum_paise <> p_amount_paise THEN
    RAISE EXCEPTION 'Splits sum (%) does not equal total amount (%).', v_sum_paise, p_amount_paise;
  END IF;

  IF p_expense_id IS NULL THEN
    -- Insert
    INSERT INTO public.expenses (
      trip_id, title, amount_paise, category, paid_by, spent_on, note,
      split_type, split_input, created_by, version
    ) VALUES (
      p_trip_id, trim(p_title), p_amount_paise, p_category, p_paid_by, p_spent_on,
      p_note, p_split_type, p_split_input, v_creator_member_id, 1
    ) RETURNING id INTO v_res_expense_id;
  ELSE
    -- Update with optimistic version check
    SELECT version INTO v_current_version FROM public.expenses WHERE id = p_expense_id AND trip_id = p_trip_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Expense not found.';
    END IF;

    IF p_expected_version IS NOT NULL AND v_current_version <> p_expected_version THEN
      RETURN jsonb_build_object('ok', false, 'conflict', true, 'current_version', v_current_version);
    END IF;

    UPDATE public.expenses
    SET title = trim(p_title),
        amount_paise = p_amount_paise,
        category = p_category,
        paid_by = p_paid_by,
        spent_on = p_spent_on,
        note = p_note,
        split_type = p_split_type,
        split_input = p_split_input
    WHERE id = p_expense_id AND trip_id = p_trip_id
    RETURNING id INTO v_res_expense_id;

    DELETE FROM public.expense_splits WHERE expense_id = v_res_expense_id;
  END IF;

  -- Insert splits
  FOR v_split IN SELECT * FROM jsonb_to_recordset(p_splits) AS x(member_id UUID, share_paise BIGINT)
  LOOP
    INSERT INTO public.expense_splits (expense_id, member_id, share_paise)
    VALUES (v_res_expense_id, v_split.member_id, v_split.share_paise);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'expense_id', v_res_expense_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_reminders ENABLE ROW LEVEL SECURITY;

-- 6.1 Profiles Policies
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trip_members tm1
      JOIN public.trip_members tm2 ON tm1.trip_id = tm2.trip_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
    )
  );

CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- 6.2 Trips Policies
CREATE POLICY "trips_select_member" ON public.trips
  FOR SELECT USING (
    public.is_trip_member(id)
    OR EXISTS (
      SELECT 1 FROM public.invites
      WHERE invites.trip_id = trips.id
        AND invites.revoked_at IS NULL
        AND (invites.expires_at IS NULL OR invites.expires_at > timezone('utc', now()))
    )
  );

CREATE POLICY "trips_insert_auth" ON public.trips
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "trips_update_admin" ON public.trips
  FOR UPDATE USING (public.is_trip_admin(id));

-- 6.3 Trip Families Policies
CREATE POLICY "trip_families_select" ON public.trip_families
  FOR SELECT USING (public.is_trip_member(trip_id));

CREATE POLICY "trip_families_insert" ON public.trip_families
  FOR INSERT WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "trip_families_update" ON public.trip_families
  FOR UPDATE USING (public.is_trip_member(trip_id));

CREATE POLICY "trip_families_delete" ON public.trip_families
  FOR DELETE USING (public.is_trip_member(trip_id));

-- 6.4 Trip Members Policies
CREATE POLICY "trip_members_select_member" ON public.trip_members
  FOR SELECT USING (
    public.is_trip_member(trip_id)
    OR EXISTS (
      SELECT 1 FROM public.invites
      WHERE invites.trip_id = trip_members.trip_id
        AND invites.revoked_at IS NULL
        AND (invites.expires_at IS NULL OR invites.expires_at > timezone('utc', now()))
    )
  );

CREATE POLICY "trip_members_insert_placeholder" ON public.trip_members
  FOR INSERT WITH CHECK (
    public.is_trip_member(trip_id) AND user_id IS NULL
  );

CREATE POLICY "trip_members_update_admin_or_self" ON public.trip_members
  FOR UPDATE USING (
    public.is_trip_admin(trip_id) OR user_id = auth.uid()
  );

-- 6.5 Category Limits Policies
CREATE POLICY "category_limits_select_member" ON public.category_limits
  FOR SELECT USING (public.is_trip_member(trip_id));

CREATE POLICY "category_limits_admin_insert" ON public.category_limits
  FOR INSERT WITH CHECK (public.is_trip_admin(trip_id));

CREATE POLICY "category_limits_admin_update" ON public.category_limits
  FOR UPDATE USING (public.is_trip_admin(trip_id));

CREATE POLICY "category_limits_admin_delete" ON public.category_limits
  FOR DELETE USING (public.is_trip_admin(trip_id));

-- 6.6 Invites Policies
-- Allows trip admins to manage invites AND allows guests to look up active invite tokens
CREATE POLICY "invites_select" ON public.invites
  FOR SELECT USING (
    public.is_trip_admin(trip_id)
    OR (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > timezone('utc', now())))
  );

CREATE POLICY "invites_insert_admin" ON public.invites
  FOR INSERT WITH CHECK (public.is_trip_admin(trip_id));

CREATE POLICY "invites_update_admin" ON public.invites
  FOR UPDATE USING (public.is_trip_admin(trip_id));

-- 6.7 Recurring Rules Policies
CREATE POLICY "recurring_rules_select" ON public.recurring_rules
  FOR SELECT USING (public.is_trip_member(trip_id));

CREATE POLICY "recurring_rules_insert" ON public.recurring_rules
  FOR INSERT WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "recurring_rules_update" ON public.recurring_rules
  FOR UPDATE USING (public.is_trip_member(trip_id));

CREATE POLICY "recurring_rules_delete" ON public.recurring_rules
  FOR DELETE USING (public.is_trip_member(trip_id));

-- 6.8 Expenses Policies
CREATE POLICY "expenses_select_member" ON public.expenses
  FOR SELECT USING (public.is_trip_member(trip_id));

CREATE POLICY "expenses_insert_member" ON public.expenses
  FOR INSERT WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "expenses_update_creator_or_admin" ON public.expenses
  FOR UPDATE USING (
    public.is_trip_admin(trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE id = expenses.created_by AND user_id = auth.uid()
    )
  );

-- 6.9 Expense Splits Policies
CREATE POLICY "expense_splits_select_member" ON public.expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id)
    )
  );

CREATE POLICY "expense_splits_insert_member" ON public.expense_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id)
    )
  );

CREATE POLICY "expense_splits_update_member" ON public.expense_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id)
    )
  );

CREATE POLICY "expense_splits_delete_member" ON public.expense_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id)
    )
  );

-- 6.10 Settlements Policies
CREATE POLICY "settlements_select_member" ON public.settlements
  FOR SELECT USING (public.is_trip_member(trip_id));

CREATE POLICY "settlements_insert_participant_or_admin" ON public.settlements
  FOR INSERT WITH CHECK (
    public.is_trip_admin(trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE id IN (from_member, to_member) AND user_id = auth.uid()
    )
  );

CREATE POLICY "settlements_update_creator_or_admin" ON public.settlements
  FOR UPDATE USING (
    public.is_trip_admin(trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE id = settlements.created_by AND user_id = auth.uid()
    )
  );

-- 6.11 Due Reminders Policies
CREATE POLICY "due_reminders_select" ON public.due_reminders
  FOR SELECT USING (public.is_trip_member(trip_id));

CREATE POLICY "due_reminders_insert" ON public.due_reminders
  FOR INSERT WITH CHECK (public.is_trip_member(trip_id));

-- ------------------------------------------------------------------------------
-- 7. ROLES & GRANTS
-- ------------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
