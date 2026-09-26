/*
# Add od_end_date column for multi-day OD registrations

1. Changes
- Add `od_end_date` (date, nullable) to the `ods` table. When null, the OD
  is a single day (od_date only). When set, the OD spans from od_date to
  od_end_date inclusive.
- Add a CHECK constraint ensuring od_end_date >= od_date when populated.
- Update the `enforce_od_category_limit()` trigger to count existing rows
  whose date range overlaps the new row's date range, so a student
  registered across multiple days counts against the limit on each day
  in that span.

2. Security
- No RLS changes. Existing policies remain valid.

3. Notes
- The column is nullable so existing single-day rows are unaffected.
- The trigger is dropped and recreated to handle range overlap logic.
- Idempotent: uses ADD COLUMN IF NOT EXISTS and drops trigger/function
  before recreating.
*/

ALTER TABLE ods
  ADD COLUMN IF NOT EXISTS od_end_date date;

ALTER TABLE ods
  DROP CONSTRAINT IF EXISTS ods_end_after_start;
ALTER TABLE ods
  ADD CONSTRAINT ods_end_after_start CHECK (od_end_date IS NULL OR od_end_date >= od_date);

DROP TRIGGER IF EXISTS ods_check_category_limit ON ods;

DROP FUNCTION IF EXISTS enforce_od_category_limit();

CREATE FUNCTION enforce_od_category_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_count integer;
  max_limit integer;
  start_date date;
  end_date date;
BEGIN
  IF NEW.category = 'other_college' THEN
    max_limit := 10;
  ELSIF NEW.category = 'inter_college' THEN
    max_limit := 5;
  ELSE
    RETURN NEW;
  END IF;

  start_date := NEW.od_date;
  end_date := COALESCE(NEW.od_end_date, NEW.od_date);

  -- Count existing registrations for this category that overlap the
  -- new row's date range. A row overlaps if its [od_date, coalesce(od_end_date, od_date)]
  -- intersects [start_date, end_date].
  SELECT count(*) INTO existing_count
  FROM ods
  WHERE category = NEW.category
    AND od_date <= end_date
    AND COALESCE(od_end_date, od_date) >= start_date;

  IF existing_count >= max_limit THEN
    RAISE EXCEPTION 'Daily limit reached for % on % (max % students)',
      NEW.category, NEW.od_date, max_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ods_check_category_limit
BEFORE INSERT ON ods
FOR EACH ROW
EXECUTE FUNCTION enforce_od_category_limit();
