import { useCallback, useEffect, useState } from 'react';
import { Check, LogOut, X } from 'lucide-react';
import { supabase, type OdRequest, type StaffProfile } from '@/lib/supabase';

interface AdvisorDashboardProps { profile: StaffProfile; }
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function AdvisorDashboard({ profile }: AdvisorDashboardProps) {
  const [requests, setRequests] = useState<OdRequest[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('od_requests').select('*, students(name, register_number, department, class_section, attendance_percentage)').eq('advisor_id', profile.user_id).order('created_at', { ascending: false });
    if (loadError) { setError('Could not load approval requests.'); return; }
    setRequests((data ?? []) as OdRequest[]);
  }, [profile.user_id]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, action: 'approve_od_request' | 'reject_od_request') => {
    setBusy(id); setError('');
    const { error: actionError } = await supabase.rpc(action, { p_request_id: id, p_comment: comment[id] || null });
    setBusy(null);
    if (actionError) { setError('The request could not be updated.'); return; }
    load();
  };
  return <main className="min-h-screen bg-[#f4f8fd] text-[#13284b]"><header className="flex items-center justify-between border-b border-[#dce7f5] bg-white px-5 py-4"><div><p className="text-sm font-bold">Advisor Dashboard</p><p className="text-xs text-[#52709e]">Welcome, {profile.full_name}</p></div><button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/advisor/login'; })} className="flex items-center gap-2 rounded-lg border border-[#d5e1f1] px-3 py-2 text-xs font-bold text-[#52709e]"><LogOut className="h-4 w-4" />Sign out</button></header><main className="mx-auto max-w-6xl space-y-5 p-5 lg:p-8"><div><h1 className="text-2xl font-bold">OD Approval Requests</h1><p className="mt-1 text-sm text-[#52709e]">Review requests from students assigned to you.</p></div>{error && <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p>}<div className="overflow-x-auto rounded-xl border border-[#dce7f5] bg-white shadow-sm"><table className="min-w-[1000px] w-full text-left text-xs"><thead className="bg-[#f7faff] uppercase text-[#58749d]"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Register No.</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">OD Count / Limit</th><th className="px-4 py-3">Requested OD</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{requests.map(request => { const student = request.students; return <tr key={request.id} className="border-t border-[#edf2f8] align-top"><td className="px-4 py-4 font-semibold">{student?.name ?? 'Unknown student'}</td><td className="px-4 py-4">{student?.register_number ?? '—'}</td><td className="px-4 py-4">{student?.department ?? '—'}{student?.class_section ? ` · ${student.class_section}` : ''}</td><td className="px-4 py-4">{student?.attendance_percentage ?? '—'}%<br /><span className="text-[#87a2c8]">Limit: configured</span></td><td className="px-4 py-4">{formatDate(request.od_date)}{request.od_end_date ? ` – ${formatDate(request.od_end_date)}` : ''}</td><td className="max-w-[180px] px-4 py-4">{request.reason || 'On-Duty'}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${request.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700' : request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{request.status}</span></td><td className="px-4 py-4">{request.status === 'Pending Approval' ? <div className="min-w-[180px] space-y-2"><input value={comment[request.id] ?? ''} onChange={e => setComment(prev => ({ ...prev, [request.id]: e.target.value }))} placeholder="Optional comment" className="w-full rounded border border-[#d5e1f1] px-2 py-1.5 outline-none focus:border-[#2279e8]" /><div className="flex gap-2"><button disabled={busy === request.id} onClick={() => decide(request.id, 'approve_od_request')} className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1.5 font-bold text-white"><Check className="h-3 w-3" />Approve</button><button disabled={busy === request.id} onClick={() => decide(request.id, 'reject_od_request')} className="flex items-center gap-1 rounded bg-red-600 px-2 py-1.5 font-bold text-white"><X className="h-3 w-3" />Reject</button></div></div> : <span className="text-[#87a2c8]">{request.advisor_comment || 'Completed'}</span>}</td></tr>; })}</tbody></table>{requests.length === 0 && <p className="p-12 text-center text-sm text-[#87a2c8]">No approval requests yet.</p>}</div></main></main>;
}
