import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type OdCategory = 'other_college' | 'inter_college';

export interface OdRegistration {
  id: string;
  student_name: string;
  roll_number: string;
  category: OdCategory;
  od_date: string;
  od_end_date: string | null;
  reason: string;
  created_at: string;
}

export const CATEGORY_LIMITS: Record<OdCategory, number> = {
  other_college: 10,
  inter_college: 5,
};

export const CATEGORY_LABELS: Record<OdCategory, string> = {
  other_college: 'Other College OD',
  inter_college: 'Inter College OD',
};
