import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type OdCategory = 'other_college' | 'inter_college';
export type StaffRole = 'admin' | 'advisor';
export type RequestStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface OdRegistration {
  id: string;
  student_id: string | null;
  student_name: string;
  roll_number: string;
  category: OdCategory;
  od_date: string;
  od_end_date: string | null;
  reason: string;
  college_name: string | null;
  created_at: string;
}

export interface StaffProfile {
  user_id: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
}

export interface Student {
  id: string;
  register_number: string;
  name: string;
  department: string | null;
  class_section: string | null;
  attendance_percentage: number | null;
  advisor_id: string | null;
  active: boolean;
}

export interface OdRequest {
  id: string;
  student_id: string;
  category: OdCategory;
  od_date: string;
  od_end_date: string | null;
  reason: string;
  college_name: string | null;
  status: RequestStatus;
  advisor_id: string | null;
  advisor_comment: string | null;
  decided_at: string | null;
  created_at: string;
  students?: Pick<Student, 'name' | 'register_number' | 'department' | 'class_section' | 'attendance_percentage'>;
}

export interface Notification {
  id: string;
  message: string;
  od_request_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const CATEGORY_LIMITS: Record<OdCategory, number> = {
  other_college: 15,
  inter_college: 5,
};

export const CATEGORY_LABELS: Record<OdCategory, string> = {
  other_college: 'Other College OD',
  inter_college: 'Inter College OD',
};
