/*
# Restore the original public OD dashboard access

1. Changes
- Restores the anonymous read, insert, update, and delete access used by the existing public OD dashboard.
- Keeps the new private advisor tables and advisor approval functions unchanged.

2. Security
- This matches the original no-student-login OD system behavior.
- Private advisor records remain protected by their existing authenticated policies.
*/

DROP POLICY IF EXISTS "staff_select_ods" ON ods;
DROP POLICY IF EXISTS "admin_insert_ods" ON ods;
DROP POLICY IF EXISTS "admin_update_ods" ON ods;
DROP POLICY IF EXISTS "admin_delete_ods" ON ods;
DROP POLICY IF EXISTS "anon_select_ods" ON ods;
DROP POLICY IF EXISTS "anon_insert_ods" ON ods;
DROP POLICY IF EXISTS "anon_update_ods" ON ods;
DROP POLICY IF EXISTS "anon_delete_ods" ON ods;

CREATE POLICY "anon_select_ods" ON ods FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_ods" ON ods FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_ods" ON ods FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_ods" ON ods FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON ods TO anon, authenticated;
