/*
# Create OD (On Duty) Registrations Table

1. New Tables
- `ods`
  - `id` (uuid, primary key)
  - `student_name` (text, not null) — the student registering
  - `roll_number` (text, not null) — student's roll number for identification
  - `category` (text, not null) — either 'other_college' or 'inter_college'
  - `od_date` (date, not null) — the date of the on-duty
  - `reason` (text, optional) — reason for the OD (e.g., event name, competition)
  - `created_at` (timestamptz, default now())

2. Constraints
- CHECK constraint on category to ensure only 'other_college' or 'inter_college'
- Index on od_date for fast calendar queries
- Index on category + od_date for limit enforcement queries

3. Security
- Enable RLS on `ods`.
- Allow anon + authenticated CRUD — this is a no-auth shared app (no login screen).
*/

CREATE TABLE IF NOT EXISTS ods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  roll_number text NOT NULL,
  category text NOT NULL CHECK (category IN ('other_college', 'inter_college')),
  od_date date NOT NULL,
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ods_od_date ON ods(od_date);
CREATE INDEX IF NOT EXISTS idx_ods_category_date ON ods(category, od_date);

ALTER TABLE ods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ods" ON ods;
CREATE POLICY "anon_select_ods" ON ods FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ods" ON ods;
CREATE POLICY "anon_insert_ods" ON ods FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ods" ON ods;
CREATE POLICY "anon_update_ods" ON ods FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ods" ON ods;
CREATE POLICY "anon_delete_ods" ON ods FOR DELETE
  TO anon, authenticated USING (true);
