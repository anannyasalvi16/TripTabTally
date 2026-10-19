-- Migration: Support families, manual members, and family split type
-- Safe for existing rows: adds nullable columns, NOT VALID constraints, and backward-compatible RPC updates.

-- 1. Create trip_families table
CREATE TABLE IF NOT EXISTS public.trip_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, name)
);

-- Enable RLS on trip_families
ALTER TABLE public.trip_families ENABLE ROW LEVEL SECURITY;

-- Policies for trip_families
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trip_families' AND policyname = 'trip_families_select'
  ) THEN
    CREATE POLICY trip_families_select ON public.trip_families
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.trip_members
          WHERE trip_members.trip_id = trip_families.trip_id
            AND trip_members.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trip_families' AND policyname = 'trip_families_insert'
  ) THEN
    CREATE POLICY trip_families_insert ON public.trip_families
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.trip_members
          WHERE trip_members.trip_id = trip_families.trip_id
            AND trip_members.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trip_families' AND policyname = 'trip_families_update'
  ) THEN
    CREATE POLICY trip_families_update ON public.trip_families
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.trip_members
          WHERE trip_members.trip_id = trip_families.trip_id
            AND trip_members.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trip_families' AND policyname = 'trip_families_delete'
  ) THEN
    CREATE POLICY trip_families_delete ON public.trip_families
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.trip_members
          WHERE trip_members.trip_id = trip_families.trip_id
            AND trip_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 2. Add family_id, email, phone columns to trip_members
ALTER TABLE public.trip_members
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.trip_families(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Add check constraint for email format if provided (NOT VALID for existing safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trip_members_email_check'
  ) THEN
    ALTER TABLE public.trip_members
      ADD CONSTRAINT trip_members_email_check
      CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
      NOT VALID;
  END IF;
END $$;

-- 3. Update expenses split_type constraint to allow 'family'
DO $$
BEGIN
  -- Drop existing split_type check constraint if present and re-add with 'family'
  ALTER TABLE public.expenses
    DROP CONSTRAINT IF EXISTS expenses_split_type_check;

  ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_split_type_check
    CHECK (split_type IN ('equal', 'exact', 'percent', 'shares', 'family'))
    NOT VALID;
END $$;

-- 4. Update join_trip function to support auto-linking by email and manual claim
CREATE OR REPLACE FUNCTION public.join_trip(
  p_token text,
  p_claim_member_id uuid default null,
  p_display_name text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_user_email text;
  v_existing_member record;
  v_target_member record;
  v_matched_member record;
  v_name text;
BEGIN
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Get user email from auth
  select email into v_user_email from auth.users where id = v_user_id;

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

  -- 1. Check if user is already an active member of this trip
  select * into v_existing_member from public.trip_members
  where trip_id = v_invite.trip_id and user_id = v_user_id;

  if found then
    return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', v_existing_member.id);
  end if;

  -- 2. If a specific member to claim was requested
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
        email = coalesce(email, v_user_email),
        joined_at = now()
    where id = p_claim_member_id;

    return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', p_claim_member_id);
  end if;

  -- 3. Auto-link if an unclaimed member matches user's email
  if v_user_email is not null and char_length(trim(v_user_email)) > 0 then
    select * into v_matched_member from public.trip_members
    where trip_id = v_invite.trip_id
      and user_id is null
      and lower(trim(email)) = lower(trim(v_user_email))
    limit 1;

    if found then
      update public.trip_members
      set user_id = v_user_id,
          display_name = coalesce(nullif(trim(p_display_name), ''), v_matched_member.display_name),
          joined_at = now()
      where id = v_matched_member.id;

      return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', v_matched_member.id);
    end if;
  end if;

  -- 4. Otherwise create a new member row
  if p_display_name is not null and char_length(trim(p_display_name)) > 0 then
    v_name := trim(p_display_name);
  else
    select display_name into v_name from public.profiles where id = v_user_id;
  end if;

  if v_name is null then
    v_name := 'Member';
  end if;

  insert into public.trip_members (trip_id, user_id, display_name, email, role, joined_at)
  values (v_invite.trip_id, v_user_id, v_name, v_user_email, 'member', now())
  returning id into p_claim_member_id;

  return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'member_id', p_claim_member_id);
END;
$$;
