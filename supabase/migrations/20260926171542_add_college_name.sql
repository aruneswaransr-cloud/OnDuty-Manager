/*
# Add college_name column for Other College OD registrations

1. Changes
- Add `college_name` (text, nullable) to the `ods` table. Used only for
  'other_college' category entries to record which college the student
  is attending. Null for 'inter_college' entries.

2. Security
- No RLS changes. Existing policies remain valid.

3. Notes
- Nullable so existing rows are unaffected.
- Idempotent: uses ADD COLUMN IF NOT EXISTS.
*/

ALTER TABLE ods
  ADD COLUMN IF NOT EXISTS college_name text;
