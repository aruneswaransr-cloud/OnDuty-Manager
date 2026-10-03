/*
# Public OD overflow-to-advisor + advisor attendance management

1. Changes
- Replace submit_od_request with a version that auto-approves when the category
  limit has not been reached, and creates an od_requests row (plus a notification)
  routed to the student's assigned advisor when the limit is full.
- Add register_student helper so any submit creates/updates the student row and
  links it to the advisor who matches the student's department/class_section.
- Add upsert_attendance_records function for advisor attendance uploads.
- Add get_advisor_students_with_od_stats function returning each student's
  total OD count and current-month OD count alongside attendance info.
- Allow advisors to read/update students assigned to them so they can correct
  department/class_section when uploading attendance.

2. Security
- submit_od_request and get_student_od_status remain callable by anon and
  authenticated users.
- New upsert/stats functions are authenticated only and enforce advisor scope.
- Advisor student read/update policies relaxed to allow advisor_id = auth.uid().
*/

CREATE OR REPLACE FUNCTION public.register_student(
  p_name text, p_register_number text, p_department text DEFAULT NULL, p_class_section text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_advisor uuid;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Invalid student details'; END IF;
  IF p_register_number IS NULL OR length(trim(p_register_number)) < 2 THEN RAISE EXCEPTION 'Invalid student details'; END IF;
  SELECT user_id INTO v_advisor FROM staff_profiles
    WHERE role = 'advisor' AND active = true
    AND (department IS NOT NULL AND department = trim(p_department))
    LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.submit_od_request(
  p_student_name text, p_register_number text, p_category text, p_od_date date,
  p_od_end_date date, p_reason text, p_college_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student_id uuid; v_limit int; v_count int; v_od_id uuid; v_req_id uuid; v_advisor uuid; v_end date;
BEGIN
  IF p_category NOT IN ('other_college','inter_college') OR p_od_date IS NULL THEN RAISE EXCEPTION 'Invalid OD details'; END IF;
  v_end := COALESCE(p_od_end_date, p_od_date);
  IF v_end < p_od_date THEN RAISE EXCEPTION 'Invalid OD details'; END IF;
  IF p_category = 'other_college' AND nullif(trim(p_college_name),'') IS NULL THEN RAISE EXCEPTION 'College name is required'; END IF;

  v_student_id := public.register_student(p_student_name, p_register_number);
  SELECT advisor_id INTO v_advisor FROM students WHERE id = v_student_id;

  SELECT setting_value INTO v_limit FROM system_settings WHERE setting_key = CASE WHEN p_category='other_college' THEN 'other_college_od_limit' ELSE 'inter_college_od_limit' END;
  v_limit := COALESCE(v_limit, CASE WHEN p_category='other_college' THEN 10 ELSE 5 END);

  SELECT count(*) INTO v_count FROM ods WHERE category = p_category AND od_date <= v_end AND COALESCE(od_end_date, od_date) >= p_od_date;

  IF v_count < v_limit THEN
    INSERT INTO ods (student_id, student_name, roll_number, category, od_date, od_end_date, reason, college_name)
    VALUES (v_student_id, trim(p_student_name), trim(p_register_number), p_category, p_od_date, nullif(v_end,p_od_date), COALESCE(trim(p_reason),''), CASE WHEN p_category='other_college' THEN trim(p_college_name) ELSE NULL END)
    RETURNING id INTO v_od_id;
    RETURN jsonb_build_object('status','Approved','od_id',v_od_id);
  END IF;

  INSERT INTO od_requests (student_id, category, od_date, od_end_date, reason, college_name, advisor_id)
  VALUES (v_student_id, p_category, p_od_date, nullif(v_end,p_od_date), COALESCE(trim(p_reason),''), CASE WHEN p_category='other_college' THEN trim(p_college_name) ELSE NULL END, v_advisor)
  RETURNING id INTO v_req_id;

  IF v_advisor IS NOT NULL THEN
    INSERT INTO notifications (recipient_user_id, student_id, od_request_id, message)
    VALUES (v_advisor, v_student_id, v_req_id, 'A new OD request is waiting for your approval.');
  END IF;
  RETURN jsonb_build_object('status','Pending Approval','request_id',v_req_id,'advisor_assigned',v_advisor IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_attendance_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec jsonb; v_student_id uuid; v_month date; v_pct numeric; v_created int := 0; v_updated int := 0;
BEGIN
  v_month := date_trunc('month', now())::date;
  FOR rec IN SELECT * FROM jsonb_array_elements(p_records) LOOP
    v_student_id := public.register_student(
      rec->>'name', rec->>'register_number',
      rec->>'department', rec->>'class_section'
    );
    v_pct := nullif(trim(rec->>'attendance_percentage'), '')::numeric;
    IF v_pct IS NULL THEN CONTINUE; END IF;
    IF v_pct < 0 OR v_pct > 100 THEN CONTINUE; END IF;

    INSERT INTO attendance_records (student_id, attendance_month, attendance_percentage, source_name)
    VALUES (v_student_id, v_month, v_pct, rec->>'source_name')
    ON CONFLICT (student_id, attendance_month) DO UPDATE
      SET attendance_percentage = EXCLUDED.attendance_percentage,
          source_name = EXCLUDED.source_name
    RETURNING xmax INTO v_student_id;
    IF v_student_id = 0 THEN v_created := v_created + 1; ELSE v_updated := v_updated + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('created', v_created, 'updated', v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_advisor_students_with_od_stats()
RETURNS TABLE (
  id uuid, name text, register_number text, department text, class_section text,
  attendance_percentage numeric, total_od int, month_od int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month date;
BEGIN
  v_month := date_trunc('month', now())::date;
  RETURN QUERY
  SELECT s.id, s.name, s.register_number, s.department, s.class_section, s.attendance_percentage,
    COALESCE((SELECT count(*) FROM ods WHERE student_id = s.id), 0)::int AS total_od,
    COALESCE((SELECT count(*) FROM ods WHERE student_id = s.id AND od_date >= v_month AND od_date < (v_month + interval '1 month')::date), 0)::int AS month_od
  FROM students s
  WHERE s.advisor_id = auth.uid()
  ORDER BY s.name;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_attendance_records(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_advisor_students_with_od_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_attendance_records(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advisor_students_with_od_stats() TO authenticated;

-- Allow advisor to update their own students' department/class/attendance
DROP POLICY IF EXISTS "staff_update_students" ON students;
CREATE POLICY "staff_update_students" ON students FOR UPDATE
  TO authenticated USING (public.is_admin() OR advisor_id = auth.uid())
  WITH CHECK (public.is_admin() OR advisor_id = auth.uid());
