/*
# Enforce per-day category limits at the database level

1. Changes
- Add a trigger function `enforce_od_category_limit()` that checks the
  number of existing rows for the same (od_date, category) and rejects
  INSERTs that would exceed the configured limits:
    other_college: 10 students per day
    inter_college:  5 students per day
- Add a BEFORE INSERT trigger `ods_check_category_limit` on the `ods` table
  that fires the function for each inserted row.

2. Security
- No RLS changes. The trigger runs with the privileges of the inserting
  role and simply raises an exception when the limit is exceeded, so the
  Supabase client receives an insert error and the row is never written.

3. Notes
- The trigger is idempotent: dropping and recreating both the function and
  the trigger makes this migration safe to re-run.
- Limits are hardcoded in the function body to match the application's
  CATEGORY_LIMITS constant.
*/

DROP TRIGGER IF EXISTS ods_check_category_limit ON ods;

DROP FUNCTION IF EXISTS enforce_od_category_limit();

CREATE FUNCTION enforce_od_category_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_count integer;
  max_limit integer;
BEGIN
  IF NEW.category = 'other_college' THEN
    max_limit := 10;
  ELSIF NEW.category = 'inter_college' THEN
    max_limit := 5;
  ELSE
    RETURN NEW; -- unknown category, allow (CHECK constraint handles validity)
  END IF;

  SELECT count(*) INTO existing_count
  FROM ods
  WHERE od_date = NEW.od_date
    AND category = NEW.category;

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
