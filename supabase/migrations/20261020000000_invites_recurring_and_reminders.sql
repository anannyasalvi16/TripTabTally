-- Migration: 20261020000000_invites_recurring_and_reminders.sql
-- Description: Supports flexible invite link expiry, recurring expense series, and rate-limited due reminders.
-- Non-destructive: Does not alter or drop any existing rows, columns, or data.

-- 1. Make invite expiry optional (support permanent invite links if creator chooses)
ALTER TABLE public.invites
  ALTER COLUMN expires_at DROP NOT NULL;

-- 2. Create recurring_rules table
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'custom')),
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days >= 1 AND interval_days <= 365),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  stopped_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_trip_id ON public.recurring_rules(trip_id);

-- RLS for recurring_rules
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_rules_select"
  ON public.recurring_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = recurring_rules.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.left_at IS NULL
    )
  );

CREATE POLICY "recurring_rules_insert"
  ON public.recurring_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = recurring_rules.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.left_at IS NULL
    )
  );

CREATE POLICY "recurring_rules_update"
  ON public.recurring_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = recurring_rules.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.left_at IS NULL
    )
  );

CREATE POLICY "recurring_rules_delete"
  ON public.recurring_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = recurring_rules.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.left_at IS NULL
    )
  );

-- 3. Link expenses to recurring_rules
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_sequence INTEGER;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_rule_id ON public.expenses(recurring_rule_id);

-- 4. Create due_reminders table for rate-limited reminders
CREATE TABLE IF NOT EXISTS public.due_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  to_member UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  channel TEXT NOT NULL DEFAULT 'share' CHECK (channel IN ('whatsapp', 'sms', 'copy', 'share')),
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_due_reminders_trip ON public.due_reminders(trip_id);
CREATE INDEX IF NOT EXISTS idx_due_reminders_rate_limit ON public.due_reminders(trip_id, from_member, reminded_at DESC);

-- RLS for due_reminders
ALTER TABLE public.due_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "due_reminders_select"
  ON public.due_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = due_reminders.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.left_at IS NULL
    )
  );

CREATE POLICY "due_reminders_insert"
  ON public.due_reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = due_reminders.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.left_at IS NULL
    )
  );
