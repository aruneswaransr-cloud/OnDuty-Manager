/*
# Add private staff access, student records, attendance, and OD approvals

1. New Tables
- `staff_profiles`: links Supabase accounts to the `admin` or `advisor` role and stores active status.
- `students`: one record per student, matched by unique register number, with department, class/section, attendance, and advisor assignment.
- `attendance_records`: attendance history kept separate from OD history, one row per student and month.
- `od_requests`: OD submissions that are waiting for advisor review or have been approved/rejected.
- `notifications`: private staff/student status notifications.
- `system_settings`: configurable OD limits; other-college defaults to 15 and inter-college defaults to 5.

2. Modified Tables
- `ods`: adds student linkage and approval audit fields while preserving all existing registrations.

3. Security
- Removes the old public CRUD policies from OD records.
- Adds authenticated role-aware policies for staff tables and official OD records.
- Adds server-side SECURITY DEFINER functions for student submission and advisor approval.
- Anonymous users can submit or check only their own OD flow through narrowly-scoped functions; they cannot read tables directly.
- Role checks use the authenticated account's staff profile, not frontend visibility.

4. Important Notes
- Existing OD rows are preserved and remain official records.
- Existing rows are linked to student records lazily by register number during later submissions.
- No authentication users are created by this migration; the private login flow creates or uses Supabase email/password accounts.
*/

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'advisor')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number text NOT NULL UNIQUE,
  name text NOT NULL,
  department text,
  class_section text,
  attendance_percentage numeric(5,2),
  advisor_id uuid REFERENCES staff_profiles(user_id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT students_attendance_range CHECK (attendance_percentage IS NULL OR (attendance_percentage >= 0 AND attendance_percentage <= 100))
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_month date NOT NULL,
  attendance_percentage numeric(5,2) NOT NULL CHECK (attendance_percentage >= 0 AND attendance_percentage <= 100),
  source_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_month)
);

CREATE TABLE IF NOT EXISTS od_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('other_college', 'inter_college')),
  od_date date NOT NULL,
  od_end_date date,
  reason text NOT NULL DEFAULT '',
  college_name text,
  status text NOT NULL DEFAULT 'Pending Approval' CHECK (status IN ('Pending Approval', 'Approved', 'Rejected')),
  advisor_id uuid REFERENCES staff_profiles(user_id) ON DELETE SET NULL,
  advisor_comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT od_requests_end_after_start CHECK (od_end_date IS NULL OR od_end_date >= od_date)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  od_request_id uuid REFERENCES od_requests(id) ON DELETE CASCADE,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key text PRIMARY KEY,
  setting_value integer NOT NULL CHECK (setting_value > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('other_college_od_limit', 15), ('inter_college_od_limit', 5)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE ods ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE ods ADD COLUMN IF NOT EXISTS source_request_id uuid REFERENCES od_requests(id) ON DELETE SET NULL;
ALTER TABLE ods ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES staff_profiles(user_id) ON DELETE SET NULL;
ALTER TABLE ods ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_students_advisor ON students(advisor_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_month ON attendance_records(student_id, attendance_month);
CREATE INDEX IF NOT EXISTS idx_od_requests_advisor_status ON od_requests(advisor_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_ods_student ON ods(student_id);

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE od_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ods ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff_profiles WHERE user_id = auth.uid() AND active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = auth.uid() AND role = 'admin' AND active = true);
$$;

REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "anon_select_ods" ON ods;
DROP POLICY IF EXISTS "anon_insert_ods" ON ods;
DROP POLICY IF EXISTS "anon_update_ods" ON ods;
DROP POLICY IF EXISTS "anon_delete_ods" ON ods;
DROP POLICY IF EXISTS "staff_select_ods" ON ods;
DROP POLICY IF EXISTS "admin_insert_ods" ON ods;
DROP POLICY IF EXISTS "admin_update_ods" ON ods;
DROP POLICY IF EXISTS "admin_delete_ods" ON ods;
CREATE POLICY "staff_select_ods" ON ods FOR SELECT TO authenticated USING (public.current_staff_role() IN ('admin', 'advisor'));
CREATE POLICY "admin_insert_ods" ON ods FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_ods" ON ods FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_ods" ON ods FOR DELETE TO authenticated USING (public.is_admin());
REVOKE ALL ON ods FROM anon;
GRANT SELECT ON ods TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ods TO authenticated;

DROP POLICY IF EXISTS "staff_select_profiles" ON staff_profiles;
DROP POLICY IF EXISTS "admin_insert_profiles" ON staff_profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON staff_profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON staff_profiles;
CREATE POLICY "staff_select_profiles" ON staff_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin_insert_profiles" ON staff_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_profiles" ON staff_profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_profiles" ON staff_profiles FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "staff_select_students" ON students;
DROP POLICY IF EXISTS "admin_insert_students" ON students;
DROP POLICY IF EXISTS "admin_update_students" ON students;
DROP POLICY IF EXISTS "admin_delete_students" ON students;
CREATE POLICY "staff_select_students" ON students FOR SELECT TO authenticated USING (public.is_admin() OR advisor_id = auth.uid());
CREATE POLICY "admin_insert_students" ON students FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_students" ON students FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_students" ON students FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "staff_select_attendance" ON attendance_records;
DROP POLICY IF EXISTS "admin_insert_attendance" ON attendance_records;
DROP POLICY IF EXISTS "admin_update_attendance" ON attendance_records;
DROP POLICY IF EXISTS "admin_delete_attendance" ON attendance_records;
CREATE POLICY "staff_select_attendance" ON attendance_records FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM students WHERE students.id = attendance_records.student_id AND students.advisor_id = auth.uid()));
CREATE POLICY "admin_insert_attendance" ON attendance_records FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_attendance" ON attendance_records FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_attendance" ON attendance_records FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "staff_select_requests" ON od_requests;
DROP POLICY IF EXISTS "admin_insert_requests" ON od_requests;
DROP POLICY IF EXISTS "staff_update_requests" ON od_requests;
DROP POLICY IF EXISTS "admin_delete_requests" ON od_requests;
CREATE POLICY "staff_select_requests" ON od_requests FOR SELECT TO authenticated USING (public.is_admin() OR advisor_id = auth.uid());
CREATE POLICY "admin_insert_requests" ON od_requests FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "staff_update_requests" ON od_requests FOR UPDATE TO authenticated USING (public.is_admin() OR advisor_id = auth.uid()) WITH CHECK (public.is_admin() OR advisor_id = auth.uid());
CREATE POLICY "admin_delete_requests" ON od_requests FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "staff_select_notifications" ON notifications;
DROP POLICY IF EXISTS "staff_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "staff_update_notifications" ON notifications;
DROP POLICY IF EXISTS "staff_delete_notifications" ON notifications;
CREATE POLICY "staff_select_notifications" ON notifications FOR SELECT TO authenticated USING (recipient_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "staff_insert_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "staff_update_notifications" ON notifications FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY "staff_delete_notifications" ON notifications FOR DELETE TO authenticated USING (recipient_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin_select_settings" ON system_settings;
DROP POLICY IF EXISTS "admin_insert_settings" ON system_settings;
DROP POLICY IF EXISTS "admin_update_settings" ON system_settings;
DROP POLICY IF EXISTS "admin_delete_settings" ON system_settings;
CREATE POLICY "admin_select_settings" ON system_settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_insert_settings" ON system_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_settings" ON system_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_settings" ON system_settings FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.submit_od_request(
  p_student_name text,
  p_register_number text,
  p_category text,
  p_od_date date,
  p_od_end_date date,
  p_reason text,
  p_college_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_limit integer;
  v_count integer;
  v_advisor uuid;
  v_request_id uuid;
  v_od_id uuid;
  v_end date := COALESCE(p_od_end_date, p_od_date);
BEGIN
  IF p_student_name IS NULL OR length(trim(p_student_name)) < 2 OR length(trim(p_student_name)) > 120 THEN RAISE EXCEPTION 'Invalid student details'; END IF;
  IF p_register_number IS NULL OR length(trim(p_register_number)) < 2 OR length(trim(p_register_number)) > 40 THEN RAISE EXCEPTION 'Invalid student details'; END IF;
  IF p_category NOT IN ('other_college', 'inter_college') OR p_od_date IS NULL OR v_end < p_od_date THEN RAISE EXCEPTION 'Invalid OD details'; END IF;
  IF p_category = 'other_college' AND nullif(trim(p_college_name), '') IS NULL THEN RAISE EXCEPTION 'College name is required'; END IF;

  INSERT INTO students (register_number, name)
  VALUES (lower(trim(p_register_number)), trim(p_student_name))
  ON CONFLICT (register_number) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
  RETURNING * INTO v_student;

  SELECT setting_value INTO v_limit FROM system_settings WHERE setting_key = CASE WHEN p_category = 'other_college' THEN 'other_college_od_limit' ELSE 'inter_college_od_limit' END;
  SELECT count(*) INTO v_count FROM ods WHERE (student_id = v_student.id OR (student_id IS NULL AND lower(trim(roll_number)) = lower(trim(p_register_number)))) AND category = p_category;
  v_advisor := v_student.advisor_id;

  IF v_count < COALESCE(v_limit, CASE WHEN p_category = 'other_college' THEN 15 ELSE 5 END) THEN
    INSERT INTO ods (student_id, student_name, roll_number, category, od_date, od_end_date, reason, college_name)
    VALUES (v_student.id, trim(p_student_name), trim(p_register_number), p_category, p_od_date, NULLIF(v_end, p_od_date), COALESCE(trim(p_reason), ''), CASE WHEN p_category = 'other_college' THEN trim(p_college_name) ELSE NULL END)
    RETURNING id INTO v_od_id;
    RETURN jsonb_build_object('status', 'Approved', 'od_id', v_od_id);
  END IF;

  INSERT INTO od_requests (student_id, category, od_date, od_end_date, reason, college_name, advisor_id)
  VALUES (v_student.id, p_category, p_od_date, NULLIF(v_end, p_od_date), COALESCE(trim(p_reason), ''), CASE WHEN p_category = 'other_college' THEN trim(p_college_name) ELSE NULL END, v_advisor)
  RETURNING id INTO v_request_id;

  IF v_advisor IS NOT NULL THEN
    INSERT INTO notifications (recipient_user_id, student_id, od_request_id, message)
    VALUES (v_advisor, v_student.id, v_request_id, 'A new OD request is waiting for your approval.');
  END IF;
  RETURN jsonb_build_object('status', 'Pending Approval', 'request_id', v_request_id, 'advisor_assigned', v_advisor IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_od_status(p_student_name text, p_register_number text)
RETURNS TABLE (id uuid, category text, od_date date, od_end_date date, reason text, status text, advisor_comment text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.category, r.od_date, r.od_end_date, r.reason, r.status, r.advisor_comment, r.created_at
  FROM public.od_requests r JOIN public.students s ON s.id = r.student_id
  WHERE lower(s.register_number) = lower(trim(p_register_number)) AND lower(s.name) = lower(trim(p_student_name))
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.approve_od_request(p_request_id uuid, p_comment text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r od_requests%ROWTYPE; v_od uuid;
BEGIN
  SELECT * INTO r FROM od_requests WHERE id = p_request_id AND status = 'Pending Approval' AND (public.is_admin() OR advisor_id = auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not authorized'; END IF;
  INSERT INTO ods (student_id, student_name, roll_number, category, od_date, od_end_date, reason, college_name, source_request_id, approved_by, approved_at)
  SELECT s.id, s.name, s.register_number, r.category, r.od_date, r.od_end_date, r.reason, r.college_name, r.id, auth.uid(), now() FROM students s WHERE s.id = r.student_id RETURNING id INTO v_od;
  UPDATE od_requests SET status = 'Approved', advisor_comment = NULLIF(trim(p_comment), ''), decided_at = now() WHERE id = r.id;
  INSERT INTO notifications (student_id, od_request_id, message) VALUES (r.student_id, r.id, 'Your OD request has been approved.');
  RETURN v_od;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_od_request(p_request_id uuid, p_comment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r od_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM od_requests WHERE id = p_request_id AND status = 'Pending Approval' AND (public.is_admin() OR advisor_id = auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or not authorized'; END IF;
  UPDATE od_requests SET status = 'Rejected', advisor_comment = NULLIF(trim(p_comment), ''), decided_at = now() WHERE id = r.id;
  INSERT INTO notifications (student_id, od_request_id, message) VALUES (r.student_id, r.id, 'Your OD request was rejected.');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_od_request(text, text, text, date, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_od_status(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_od_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_od_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_od_request(text, text, text, date, date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_od_status(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_od_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_od_request(uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS ods_check_category_limit ON ods;
DROP FUNCTION IF EXISTS enforce_od_category_limit();
CREATE OR REPLACE FUNCTION enforce_od_category_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_count integer; max_limit integer; start_date date; end_date date;
BEGIN
  SELECT setting_value INTO max_limit FROM system_settings WHERE setting_key = CASE WHEN NEW.category = 'other_college' THEN 'other_college_od_limit' ELSE 'inter_college_od_limit' END;
  start_date := NEW.od_date; end_date := COALESCE(NEW.od_end_date, NEW.od_date);
  SELECT count(*) INTO existing_count FROM ods WHERE category = NEW.category AND od_date <= end_date AND COALESCE(od_end_date, od_date) >= start_date AND id <> COALESCE(NEW.id, gen_random_uuid());
  IF existing_count >= COALESCE(max_limit, CASE WHEN NEW.category = 'other_college' THEN 15 ELSE 5 END) THEN RAISE EXCEPTION 'OD limit reached' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER ods_check_category_limit BEFORE INSERT ON ods FOR EACH ROW EXECUTE FUNCTION enforce_od_category_limit();
