import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type StaffProfile, type StaffRole } from '@/lib/supabase';

interface ProtectedStaffProps { role: StaffRole; children: (profile: StaffProfile) => ReactNode; }

export default function ProtectedStaff({ role, children }: ProtectedStaffProps) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = role === 'admin' ? '/admin/login' : '/advisor/login'; return; }
      const { data } = await supabase.from('staff_profiles').select('user_id, full_name, role, active').eq('user_id', session.user.id).maybeSingle();
      if (!mounted) return;
      if (!data || !data.active || data.role !== role) {
        await supabase.auth.signOut();
        window.location.href = role === 'admin' ? '/admin/login' : '/advisor/login';
        return;
      }
      setProfile(data as StaffProfile);
      setChecking(false);
    };
    check();
    return () => { mounted = false; };
  }, [role]);

  if (checking || !profile) return <div className="flex min-h-screen items-center justify-center bg-[#f4f8fd]"><Loader2 className="h-7 w-7 animate-spin text-[#1678ed]" /></div>;
  return <>{children(profile)}</>;
}
