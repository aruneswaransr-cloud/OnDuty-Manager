import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Check, LogOut, X, Upload, Users, FileText, Loader2, CalendarClock } from 'lucide-react';
import { supabase, type OdRequest, type StaffProfile } from '@/lib/supabase';

interface AdvisorDashboardProps { profile: StaffProfile; }
type Tab = 'approvals' | 'attendance' | 'students';
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

interface StudentStat {
  id: string; name: string; register_number: string; department: string | null;
  class_section: string | null; attendance_percentage: number | null;
  total_od: number; month_od: number;
}

export default function AdvisorDashboard({ profile }: AdvisorDashboardProps) {
  const [tab, setTab] = useState<Tab>('approvals');
  const [requests, setRequests] = useState<OdRequest[]>([]);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('od_requests')
      .select('*, students(name, register_number, department, class_section, attendance_percentage)')
      .eq('advisor_id', profile.user_id).order('created_at', { ascending: false });
    if (loadError) { setError('Could not load approval requests.'); return; }
    setRequests((data ?? []) as OdRequest[]);
  }, [profile.user_id]);
  useEffect(() => { load(); }, [load]);

  const loadStudents = useCallback(async () => {
    const { data, error: statsError } = await supabase.rpc('get_advisor_students_with_od_stats');
    if (statsError) { setError('Could not load student details.'); return; }
    setStudents((data ?? []) as StudentStat[]);
  }, []);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  const decide = async (id: string, action: 'approve_od_request' | 'reject_od_request') => {
    setBusy(id); setError('');
    const { error: actionError } = await supabase.rpc(action, { p_request_id: id, p_comment: comment[id] || null });
    setBusy(null);
    if (actionError) { setError('The request could not be updated.'); return; }
    load(); loadStudents();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setNotice('');
    try {
      let rows: Record<string, unknown>[] = [];
      const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('empty');
        const delimiter = lines[0].includes(',') ? ',' : lines[0].includes('\t') ? '\t' : ';';
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter);
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? ''; });
          rows.push(row);
        }
      }
      const normalized = rows.map(row => {
        const get = (...keys: string[]) => { for (const k of keys) { const v = Object.entries(row).find(([key]) => key.replace(/[^a-z0-9]/g, '_') === k); if (v && String(v[1]).trim()) return String(v[1]).trim(); } return ''; };
        const attendance = Number(get('attendance_percentage', 'attendance', 'percentage'));
        return {
          name: get('name', 'student_name'),
          register_number: get('register_number', 'register_no', 'roll_number', 'reg_no'),
          department: get('department', 'dept'),
          class_section: get('class_section', 'section', 'class'),
          attendance_percentage: Number.isFinite(attendance) && attendance >= 0 && attendance <= 100 ? attendance : null,
        };
      }).filter(r => r.name && r.register_number);

      if (normalized.length === 0) { setError('No valid rows found. Include name and register number columns.'); setUploading(false); event.target.value = ''; return; }
      const { data, error: rpcError } = await supabase.rpc('upsert_attendance_records', { p_records: JSON.stringify(normalized.map(r => ({ ...r, attendance_percentage: String(r.attendance_percentage ?? ''), source_name: file.name }))) });
      setUploading(false); event.target.value = '';
      if (rpcError) { setError('Attendance could not be saved.'); return; }
      const result = data as { created: number; updated: number };
      setNotice(`${normalized.length} rows processed. ${result.created} new, ${result.updated} updated. Duplicates were skipped.`);
      loadStudents();
    } catch {
      setError('This file could not be read. Use a CSV, Excel, or text file with name and register number columns.');
      setUploading(false); event.target.value = '';
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Check }[] = [
    { key: 'approvals', label: 'Approval Requests', icon: FileText },
    { key: 'attendance', label: 'Upload Attendance', icon: Upload },
    { key: 'students', label: 'Student Details', icon: Users },
  ];

  return <main className="min-h-screen bg-[#f4f8fd] text-[#13284b]">
    <header className="flex items-center justify-between border-b border-[#dce7f5] bg-white px-5 py-4">
      <div><p className="text-sm font-bold">Advisor Dashboard</p><p className="text-xs text-[#52709e]">Welcome, {profile.full_name}</p></div>
      <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/advisor/login'; })} className="flex items-center gap-2 rounded-lg border border-[#d5e1f1] px-3 py-2 text-xs font-bold text-[#52709e]"><LogOut className="h-4 w-4" />Sign out</button>
    </header>
    <main className="mx-auto max-w-6xl space-y-5 p-5 lg:p-8">
      <div className="flex flex-wrap gap-2">{tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${tab === key ? 'bg-[#1678ed] text-white' : 'border border-[#d5e1f1] bg-white text-[#52709e]'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">{notice}</p>}

      {tab === 'approvals' && <div className="overflow-x-auto rounded-xl border border-[#dce7f5] bg-white shadow-sm">
        <table className="min-w-[1000px] w-full text-left text-xs"><thead className="bg-[#f7faff] uppercase text-[#58749d]"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Register No.</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Requested OD</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
        <tbody>{requests.map(request => { const student = request.students; return <tr key={request.id} className="border-t border-[#edf2f8] align-top"><td className="px-4 py-4 font-semibold">{student?.name ?? 'Unknown student'}</td><td className="px-4 py-4">{student?.register_number ?? '—'}</td><td className="px-4 py-4">{student?.department ?? '—'}{student?.class_section ? ` · ${student.class_section}` : ''}</td><td className="px-4 py-4">{student?.attendance_percentage ?? '—'}%</td><td className="px-4 py-4">{formatDate(request.od_date)}{request.od_end_date ? ` – ${formatDate(request.od_end_date)}` : ''}</td><td className="max-w-[180px] px-4 py-4">{request.reason || 'On-Duty'}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${request.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700' : request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{request.status}</span></td><td className="px-4 py-4">{request.status === 'Pending Approval' ? <div className="min-w-[180px] space-y-2"><input value={comment[request.id] ?? ''} onChange={e => setComment(prev => ({ ...prev, [request.id]: e.target.value }))} placeholder="Optional comment" className="w-full rounded border border-[#d5e1f1] px-2 py-1.5 outline-none focus:border-[#2279e8]" /><div className="flex gap-2"><button disabled={busy === request.id} onClick={() => decide(request.id, 'approve_od_request')} className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1.5 font-bold text-white"><Check className="h-3 w-3" />Approve</button><button disabled={busy === request.id} onClick={() => decide(request.id, 'reject_od_request')} className="flex items-center gap-1 rounded bg-red-600 px-2 py-1.5 font-bold text-white"><X className="h-3 w-3" />Reject</button></div></div> : <span className="text-[#87a2c8]">{request.advisor_comment || 'Completed'}</span>}</td></tr>; })}</tbody></table>
        {requests.length === 0 && <p className="p-12 text-center text-sm text-[#87a2c8]">No approval requests yet.</p>}
      </div>}

      {tab === 'attendance' && <div className="rounded-xl border border-[#dce7f5] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Upload Class Attendance</h2>
        <p className="mt-1 text-sm text-[#52709e]">Upload attendance in any file format (CSV, Excel, or text). Required columns: Name and Register Number. Optional: Department, Class/Section, and Attendance Percentage. Matching register numbers update existing records — no duplicates are created.</p>
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-6 py-12 text-center">
          {uploading ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> : <Upload className="h-8 w-8 text-blue-600" />}
          <span className="mt-3 text-sm font-bold text-blue-700">{uploading ? 'Processing file...' : 'Choose attendance file'}</span>
          <span className="mt-1 text-xs text-[#52709e]">CSV, XLS, XLSX, TXT, or any text-based format</span>
          <input type="file" onChange={handleFile} className="hidden" />
        </label>
      </div>}

      {tab === 'students' && <div className="overflow-x-auto rounded-xl border border-[#dce7f5] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e5edf7] px-5 py-4"><CalendarClock className="h-5 w-5 text-[#173e78]" /><h2 className="text-sm font-bold">Student Details & OD Summary</h2></div>
        <table className="min-w-[800px] w-full text-left text-xs"><thead className="bg-[#f7faff] text-[#58749d]"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Register No.</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">This Month OD</th><th className="px-4 py-3">Total OD</th></tr></thead>
        <tbody>{students.map(s => <tr key={s.id} className="border-t border-[#edf2f8]"><td className="px-4 py-3 font-semibold">{s.name}</td><td className="px-4 py-3">{s.register_number}</td><td className="px-4 py-3">{s.department || '—'}{s.class_section ? ` · ${s.class_section}` : ''}</td><td className="px-4 py-3">{s.attendance_percentage ?? '—'}%</td><td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{s.month_od}</span></td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{s.total_od}</span></td></tr>)}</tbody></table>
        {students.length === 0 && <p className="p-10 text-center text-sm text-[#87a2c8]">No student records yet. Upload attendance to see students here.</p>}
      </div>}
    </main>
  </main>;
}
