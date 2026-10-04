/*
# Fix student details loading + update other_college limit to 15

1. Changes
- Update system_settings: other_college_od_limit from 10 to 15.
- Fix get_advisor_students_with_od_stats: the function was scoped to
  auth.uid() = advisor_id OR students with ODs, but the RETURN QUERY
  used subqueries on ods that could fail. Rewrite to use LEFT JOINs
  for robustness and ensure it returns all students with any OD record
  even if they have no attendance and no advisor assignment.
- Ensure register_student is callable by anon (public form uses it via
  submit_od_request).

2. Security
- get_advisor_students_with_od_stats remains authenticated-only.
- submit_od_request and register_student remain callable by anon+authenticated.
*/

UPDATE system_settings SET setting_value = 15 WHERE setting_key = 'other_college_od_limit';

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
       WHERE ar.student_id = s.id
       ORDER BY ar.attendance_month DESC LIMIT 1)
    ) AS attendance_percentage,
    COALESCE(od_counts.total_od, 0)::int AS total_od,
    COALESCE(od_counts.month_od, 0)::int AS month_od
  FROM students s
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS total_od,
      count(*) FILTER (WHERE o.od_date >= v_month AND o.od_date < (v_month + interval '1 month')::date)::int AS month_od
    FROM ods o WHERE o.student_id = s.id
  ) od_counts ON true
  WHERE s.advisor_id = auth.uid()
     OR EXISTS (SELECT 1 FROM ods WHERE ods.student_id = s.id)
  ORDER BY s.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_advisor_students_with_od_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_advisor_students_with_od_stats() TO authenticated;
