-- Migration: Add date validation constraints and triggers for trips and expenses
-- Safe for existing rows: uses NOT VALID constraints and triggers that apply only to new/updated rows.

-- 1. Year range constraints (4-digit years: 1000 to 9999)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_start_date_year_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_start_date_year_check
      CHECK (start_date IS NULL OR (extract(year from start_date) BETWEEN 1000 AND 9999))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_end_date_year_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_end_date_year_check
      CHECK (end_date IS NULL OR (extract(year from end_date) BETWEEN 1000 AND 9999))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_spent_on_year_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_spent_on_year_check
      CHECK (extract(year from spent_on) BETWEEN 1000 AND 9999)
      NOT VALID;
  END IF;
END $$;

-- 2. Trigger function to enforce sane limits on trips:
--    - min: CURRENT_DATE - 1 year
--    - max: CURRENT_DATE + 5 years
--    - end_date >= start_date
CREATE OR REPLACE FUNCTION public.validate_trip_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  min_date date := (CURRENT_DATE - INTERVAL '1 year')::date;
  max_date date := (CURRENT_DATE + INTERVAL '5 years')::date;
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
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_dates();

-- 3. Trigger function to enforce expense dates within trip start-end range:
--    - If trip has start_date and end_date: spent_on must be between start_date and end_date
--    - If trip has only start_date: spent_on >= start_date and spent_on <= CURRENT_DATE + 5 years
--    - If trip has only end_date: spent_on <= end_date and spent_on >= CURRENT_DATE - 1 year
--    - If trip has neither: spent_on between CURRENT_DATE - 1 year and CURRENT_DATE + 5 years
CREATE OR REPLACE FUNCTION public.validate_expense_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_start date;
  v_trip_end date;
  min_date date := (CURRENT_DATE - INTERVAL '1 year')::date;
  max_date date := (CURRENT_DATE + INTERVAL '5 years')::date;
BEGIN
  -- Fetch trip bounds
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
    -- Trip has neither start nor end date: enforce sane limits
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
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_date();
