/*
# Fix register_student: staff_profiles has no department column

1. Root cause
- register_student referenced staff_profiles.department which does not exist.
  This caused every submit_od_request call to fail with "column department does
  not exist", surfacing as "Something went wrong" in the registration modal.

2. Fix
- Add a nullable department column to staff_profiles so advisors can optionally
  be associated with a department.
- Rewrite the advisor lookup in register_student to use COALESCE: first try to
  match by department, then fall back to any active advisor. This way student
  registration works even when no advisor has a department set.
- Grant anon + authenticated EXECUTE on submit_od_request and register_student
  (the public form calls these without authentication).
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='staff_profiles' AND column_name='department') THEN
    ALTER TABLE staff_profiles ADD COLUMN department text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.register_student(
  p_name text, p_register_number text, p_department text DEFAULT NULL, p_class_section text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_advisor uuid;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Invalid student details'; END IF;
  IF p_register_number IS NULL OR length(trim(p_register_number)) < 2 THEN RAISE EXCEPTION 'Invalid student details'; END IF;

  -- Try matching advisor by department first, then fall back to any active advisor
  SELECT user_id INTO v_advisor FROM staff_profiles
    WHERE role = 'advisor' AND active = true
    AND department IS NOT NULL AND department = trim(p_department)
    LIMIT 1;

  IF v_advisor IS NULL THEN
    SELECT user_id INTO v_advisor FROM staff_profiles
      WHERE role = 'advisor' AND active = true
      LIMIT 1;
  END IF;

  INSERT INTO students (register_number, name, department, class_section, advisor_id, updated_at)
  VALUES (lower(trim(p_register_number)), trim(p_name), nullif(trim(p_department), ''), nullif(trim(p_class_section), ''), v_advisor, now())
  ON CONFLICT (register_number) DO UPDATE
    SET name = EXCLUDED.name,
        department = COALESCE(nullif(trim(p_department), ''), students.department),
        class_section = COALESCE(nullif(trim(p_class_section), ''), students.class_section),
        advisor_id = COALESCE(students.advisor_id, v_advisor),
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_od_request(text,text,text,date,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_od_request(text,text,text,date,date,text,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.register_student(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_student(text,text,text,text) TO anon, authenticated;
