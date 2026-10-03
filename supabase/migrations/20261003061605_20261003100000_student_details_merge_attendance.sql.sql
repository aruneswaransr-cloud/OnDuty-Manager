/*
# Student details: show OD students without attendance + merge on upload

1. Changes
- Replace get_advisor_students_with_od_stats so it returns ALL students who either
  are assigned to the advisor OR have at least one OD record. This ensures students
  who registered ODs through the public form (without attendance uploaded yet)
  still appear with their OD counts.
- Pull attendance_percentage from the latest attendance_records row for the current
  month if the students table column is NULL, so data merges correctly.
- Update upsert_attendance_records to also set students.attendance_percentage,
  students.department, and students.class_section so uploaded details are reflected
  immediately in the student details view without a separate join.

2. Security
- get_advisor_students_with_od_stats remains authenticated-only and scoped to the
  calling advisor's students plus any student with OD records (so the advisor can
  see OD activity even for students not yet formally assigned).
- upsert_attendance_records remains authenticated-only.
*/

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
  SELECT s.id, s.name, s.register_number, s.department, s.class_section,
    COALESCE(s.attendance_percentage,
      (SELECT ar.attendance_percentage FROM attendance_records ar
       WHERE ar.student_id = s.id AND ar.attendance_month = v_month
       ORDER BY ar.updated_at DESC LIMIT 1)
    ) AS attendance_percentage,
    COALESCE((SELECT count(*) FROM ods WHERE student_id = s.id), 0)::int AS total_od,
    COALESCE((SELECT count(*) FROM ods WHERE student_id = s.id AND od_date >= v_month AND od_date < (v_month + interval '1 month')::date), 0)::int AS month_od
  FROM students s
  WHERE s.advisor_id = auth.uid()
     OR EXISTS (SELECT 1 FROM ods WHERE ods.student_id = s.id)
  ORDER BY s.name;
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

    UPDATE students
      SET attendance_percentage = v_pct,
          department = COALESCE(nullif(trim(rec->>'department'), ''), students.department),
          class_section = COALESCE(nullif(trim(rec->>'class_section'), ''), students.class_section),
          updated_at = now()
      WHERE id = v_student_id;
  END LOOP;
  RETURN jsonb_build_object('created', v_created, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.get_advisor_students_with_od_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_advisor_students_with_od_stats() TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_attendance_records(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_attendance_records(jsonb) TO authenticated;
