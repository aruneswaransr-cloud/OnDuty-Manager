import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  GraduationCap, Plus, Bell, LayoutDashboard, FileText, BarChart3,
  CalendarRange, Search, ChevronRight, Users, Building2, School, CalendarClock,
  Upload, LogOut, Check, X, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, type OdRegistration, type OdRequest, type StaffProfile } from '@/lib/supabase';
import Calendar from '@/components/Calendar';
import RegisterModal from '@/components/RegisterModal';
import OdList from '@/components/OdList';
import PrivateLogin from '@/components/PrivateLogin';
import ProtectedStaff from '@/components/ProtectedStaff';

type ListFilter = 'all' | 'past' | 'future';
type NavView = 'dashboard' | 'calendar' | 'records' | 'reports' | 'approvals' | 'attendance' | 'students';
type ReportTab = 'overall' | 'today' | 'upcoming';

function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtDate(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDayMonth(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }

interface StudentStat {
  id: string; name: string; register_number: string; department: string | null;
  class_section: string | null; attendance_percentage: number | null;
  total_od: number; month_od: number;
}

function MainDashboard({ profile }: { profile: StaffProfile | null }) {
  const [ods, setOds] = useState<OdRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerDate, setRegisterDate] = useState<Date | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [navView, setNavView] = useState<NavView>('dashboard');
  const [reportTab, setReportTab] = useState<ReportTab>('overall');
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);

  // Advisor state
  const [requests, setRequests] = useState<OdRequest[]>([]);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [advisorError, setAdvisorError] = useState('');
  const [advisorNotice, setAdvisorNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isAdvisor = profile !== null;

  const fetchOds = useCallback(async () => {
    const { data, error } = await supabase.from('ods').select('*').order('od_date', { ascending: true });
    if (error) { console.error('Failed to fetch ODs:', error); return; }
    setOds((data ?? []) as OdRegistration[]); setLoading(false);
  }, []);
  useEffect(() => { fetchOds(); }, [fetchOds]);

  const loadRequests = useCallback(async () => {
    if (!profile) return;
    const { data, error: loadError } = await supabase.from('od_requests')
      .select('*, students(name, register_number, department, class_section, attendance_percentage)')
      .eq('advisor_id', profile.user_id).order('created_at', { ascending: false });
    if (loadError) { setAdvisorError('Could not load approval requests.'); return; }
    setRequests((data ?? []) as OdRequest[]);
  }, [profile]);
  useEffect(() => { if (isAdvisor) loadRequests(); }, [loadRequests, isAdvisor]);

  const loadStudents = useCallback(async () => {
    if (!profile) return;
    const { data, error: statsError } = await supabase.rpc('get_advisor_students_with_od_stats');
    if (statsError) { setAdvisorError('Could not load student details.'); return; }
    setStudents((data ?? []) as StudentStat[]);
  }, [profile]);
  useEffect(() => { if (isAdvisor) loadStudents(); }, [loadStudents, isAdvisor]);

  const handleDelete = async (id: string) => { setOds(prev => prev.filter(o => o.id !== id)); await supabase.from('ods').delete().eq('id', id); fetchOds(); };

  const decide = async (id: string, action: 'approve_od_request' | 'reject_od_request') => {
    setBusy(id); setAdvisorError('');
    const { error: actionError } = await supabase.rpc(action, { p_request_id: id, p_comment: comment[id] || null });
    setBusy(null);
    if (actionError) { setAdvisorError('The request could not be updated.'); return; }
    loadRequests(); loadStudents(); fetchOds();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setAdvisorError(''); setAdvisorNotice('');
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

      if (normalized.length === 0) { setAdvisorError('No valid rows found. Include name and register number columns.'); setUploading(false); event.target.value = ''; return; }
      const { data, error: rpcError } = await supabase.rpc('upsert_attendance_records', { p_records: JSON.stringify(normalized.map(r => ({ ...r, attendance_percentage: String(r.attendance_percentage ?? ''), source_name: file.name }))) });
      setUploading(false); event.target.value = '';
      if (rpcError) { setAdvisorError('Attendance could not be saved.'); return; }
      const result = data as { created: number; updated: number };
      setAdvisorNotice(`${normalized.length} rows processed. ${result.created} new, ${result.updated} updated. Duplicates were skipped.`);
      loadStudents();
    } catch {
      setAdvisorError('This file could not be read. Use a CSV, Excel, or text file with name and register number columns.');
      setUploading(false); event.target.value = '';
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0); const todayKey = dateKey(today);
  const todayOds = ods.filter(o => o.od_date <= todayKey && (o.od_end_date ?? o.od_date) >= todayKey);
  const upcomingOds = ods.filter(o => o.od_date > todayKey).length;
  const otherToday = todayOds.filter(o => o.category === 'other_college').length;
  const interToday = todayOds.filter(o => o.category === 'inter_college').length;
  const upcomingList = ods.filter(o => o.od_date > todayKey).slice(0, 4);
  const recentRegistrations = [...ods].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const pendingCount = requests.filter(r => r.status === 'Pending Approval').length;

  const cards = [
    { label: "Today's OD", value: String(todayOds.length), note: 'students going on OD today', icon: Users, color: 'blue' },
    { label: 'Other College', value: `${otherToday} / 15`, note: `${15 - otherToday} slots available`, icon: Building2, color: 'green' },
    { label: 'Inter-College', value: `${interToday} / 5`, note: `${5 - interToday} slots available`, icon: School, color: 'purple' },
    { label: 'Upcoming OD', value: String(upcomingOds), note: 'students with upcoming OD', icon: CalendarClock, color: 'orange' },
  ];
  const cardStyles: Record<string, string> = { blue: 'border-blue-100 bg-blue-50/40 text-blue-700', green: 'border-emerald-100 bg-emerald-50/40 text-emerald-700', purple: 'border-fuchsia-100 bg-fuchsia-50/40 text-fuchsia-700', orange: 'border-orange-100 bg-orange-50/50 text-orange-700' };

  const navItems: { label: string; icon: typeof LayoutDashboard; view: NavView | 'register'; badge?: number }[] = [
    { label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
    { label: 'OD Calendar', icon: CalendarRange, view: 'calendar' },
    ...(isAdvisor ? [] : [{ label: 'Register OD', icon: Plus, view: 'register' as NavView | 'register' }]),
    { label: 'OD Records', icon: FileText, view: 'records' },
    { label: 'Reports', icon: BarChart3, view: 'reports' },
    ...(isAdvisor ? [
      { label: 'Approval Requests', icon: Check, view: 'approvals' as NavView, badge: pendingCount },
      { label: 'Upload Attendance', icon: Upload, view: 'attendance' as NavView },
      { label: 'Student Details', icon: Users, view: 'students' as NavView },
    ] : []),
  ];

  const handleNavClick = (item: typeof navItems[number]) => item.view === 'register' ? setRegisterDate(new Date()) : setNavView(item.view);
  const viewTitles: Record<NavView, { title: string; subtitle: string }> = {
    dashboard: { title: 'College On-Duty Management', subtitle: today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
    calendar: { title: 'OD Calendar', subtitle: isAdvisor ? 'Click any date to view OD details for that day' : 'Click any date to register an OD for that day' },
    records: { title: 'OD Records', subtitle: 'Search, filter, and manage all registered on-duty records' },
    reports: { title: 'Reports', subtitle: 'Summary statistics and capacity utilization' },
    approvals: { title: 'Approval Requests', subtitle: 'Review overflow OD requests from students assigned to you' },
    attendance: { title: 'Upload Attendance', subtitle: 'Upload class attendance in any file format' },
    students: { title: 'Student Details', subtitle: 'Student OD summary for this month and overall' },
  };
  const currentTitle = viewTitles[navView];

  return <div className="min-h-screen bg-[#f4f8fd] text-[#13284b]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 bg-[#102443] text-white lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2868ed] text-white shadow-lg shadow-blue-900/30"><GraduationCap className="h-6 w-6" /></div>
        <div><p className="text-sm font-bold leading-tight">College OD</p><p className="text-sm font-bold leading-tight">Management</p></div>
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6">
        {navItems.map(item => { const Icon = item.icon; const isActive = item.view !== 'register' && item.view === navView; return (
          <button key={item.label} onClick={() => handleNavClick(item)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${isActive ? 'bg-[#1478ed] text-white shadow-lg shadow-blue-900/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span> : null}
          </button>
        ); })}
      </nav>
      <div className="border-t border-white/10 px-5 py-5 text-[11px] text-slate-300">
        {isAdvisor ? <>
          <p className="font-semibold text-white">{profile!.full_name}</p>
          <p className="mt-1">Advisor</p>
          <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/advisor/login'; })} className="mt-3 flex items-center gap-1.5 text-blue-300 hover:text-white"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </> : <>
          <p className="font-semibold text-white">College On-Duty Management</p>
          <p className="mt-1">Plan · Register · Go Forward</p>
        </>}
      </div>
    </aside>

    <div className="lg:pl-56">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div><h1 className="text-xl font-bold tracking-tight text-[#13284b]">{currentTitle.title}</h1><p className="text-xs text-[#52709e]">{currentTitle.subtitle}</p></div>
          <div className="flex items-center gap-3">
            {!isAdvisor && <button onClick={() => setRegisterDate(new Date())} className="flex items-center gap-2 rounded-lg bg-[#1678ed] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d67d4]"><Plus className="h-4 w-4" />Register OD</button>}
          </div>
        </div>
      </header>

      {/* Mobile nav scroll bar */}
      <div className="flex gap-2 overflow-x-auto px-5 py-3 lg:hidden">
        {navItems.map(item => { const Icon = item.icon; const isActive = item.view !== 'register' && item.view === navView; return (
          <button key={item.label} onClick={() => handleNavClick(item)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${isActive ? 'bg-[#1678ed] text-white' : 'border border-[#d5e1f1] bg-white text-[#52709e]'}`}><Icon className="h-3.5 w-3.5" />{item.label}{item.badge ? <span className="rounded-full bg-amber-500 px-1 text-[9px] text-white">{item.badge}</span> : null}</button>
        ); })}
      </div>

      <main className="mx-auto max-w-[1500px] space-y-5 p-5 lg:p-7">
        {navView === 'dashboard' && <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map(card => { const Icon = card.icon; return (
              <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${cardStyles[card.color]}`}>
                <div className="flex items-start justify-between"><div className="rounded-full bg-white/70 p-3"><Icon className="h-6 w-6" /></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{card.color === 'orange' ? 'Upcoming' : 'Available'}</span></div>
                <p className="mt-2 text-xs font-bold text-[#18345f]">{card.label}</p><p className="mt-1 text-2xl font-bold text-[#122b52]">{card.value}</p><p className="text-[11px] text-[#55739d]">{card.note}</p>
              </div>
            ); })}
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <div className="space-y-5">
              <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e5edf7] px-5 py-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Users className="h-5 w-5 text-[#173e78]" />Today's On-Duty Students</h2><button onClick={() => setNavView('records')} className="flex items-center gap-1 rounded-lg border border-blue-100 px-3 py-1.5 text-[11px] font-bold text-blue-600">View All Today's OD<ChevronRight className="h-3 w-3" /></button></div>
                <div className="overflow-x-auto"><div className="min-w-[680px]">
                  <div className="grid grid-cols-[1.2fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr] bg-[#f7faff] px-5 py-2 text-[10px] font-bold uppercase text-[#58749d]"><span>Student Name</span><span>Roll No</span><span>Event</span><span>College</span><span>Type</span><span>OD Period</span></div>
                  {todayOds.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No students registered for today yet.</p> : todayOds.slice(0, 6).map(od => <div key={od.id} className="grid grid-cols-[1.2fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr] items-center border-t border-[#edf2f8] px-5 py-3 text-[11px] text-[#385579]"><span className="font-semibold text-[#24436d]">{od.student_name}</span><span>{od.roll_number}</span><span>{od.reason || 'On-Duty'}</span><span>{od.college_name || 'Other College'}</span><span><b className="rounded-full bg-blue-100 px-2 py-1 text-[10px] text-blue-700">{od.category === 'inter_college' ? 'Inter-College' : 'Other College'}</b></span><span>{fmtDate(od.od_date)}{od.od_end_date ? ` → ${fmtDate(od.od_end_date)}` : ''}</span></div>)}
                </div></div>
              </div>
              <Calendar ods={ods} onDateClick={isAdvisor ? setCalendarDate : setRegisterDate} />
            </div>
            <div className="space-y-5">
              <div className="rounded-xl border border-[#dce7f5] bg-white p-4 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-5 w-5 text-[#173e78]" />Daily Capacity</h2><div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4"><p className="text-xs font-bold">Other College OD</p><p className="mt-1 text-xl font-bold">{otherToday} / 15</p><div className="mt-2 h-1.5 rounded-full bg-blue-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (otherToday / 15) * 100)}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">{15 - otherToday} slots remaining</p></div>
                <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/40 p-4"><p className="text-xs font-bold">Inter-College OD</p><p className="mt-1 text-xl font-bold">{interToday} / 5</p><div className="mt-2 h-1.5 rounded-full bg-fuchsia-100"><div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${Math.min(100, interToday * 20)}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">{5 - interToday} slots remaining</p></div>
              </div></div>
              <div className="rounded-xl border border-[#dce7f5] bg-white p-4 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-5 w-5 text-[#173e78]" />Upcoming On-Duty</h2><div className="mt-3 space-y-2">{upcomingList.length ? upcomingList.map(od => <button key={od.id} onClick={() => setRegisterDate(new Date(`${od.od_date}T00:00:00`))} className="flex w-full items-center gap-3 rounded-lg border border-[#edf2f8] p-2 text-left"><span className="rounded-lg bg-blue-50 px-2 py-1 text-center text-[10px] font-bold text-blue-700">{fmtDayMonth(od.od_date)}</span><span className="min-w-0 flex-1"><b className="block truncate text-[11px]">{od.reason || 'On-Duty'}</b><small className="text-[10px] text-slate-500">{od.student_name}</small></span></button>) : <p className="py-6 text-center text-xs text-slate-400">No upcoming ODs.</p>}</div></div>
              <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm"><div className="border-b border-[#e5edf7] px-5 py-4 text-sm font-bold">Recent Registrations</div>{recentRegistrations.map(od => <div key={od.id} className="grid grid-cols-4 border-t border-[#edf2f8] px-5 py-3 text-[11px] text-[#385579]"><span className="font-semibold">{od.student_name}</span><span>{od.roll_number}</span><span>{od.reason || 'On-Duty'}</span><span>{od.college_name || 'Other College'}</span></div>)}</div>
            </div>
          </section>
        </>}

        {navView === 'calendar' && <Calendar ods={ods} onDateClick={isAdvisor ? setCalendarDate : setRegisterDate} />}

        {navView === 'records' && <section className="space-y-4"><div className="flex gap-2">{(['all', 'past', 'future'] as ListFilter[]).map(filter => <button key={filter} onClick={() => setListFilter(filter)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${listFilter === filter ? 'bg-[#1678ed] text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>{filter === 'all' ? 'All ODs' : filter === 'past' ? 'Past' : 'Upcoming'}</button>)}</div>{loading ? <div className="rounded-xl bg-white p-12 text-center">Loading...</div> : <OdList ods={ods} filter={listFilter} onDelete={handleDelete} />}</section>}

        {navView === 'reports' && <section className="space-y-4">
          <div className="flex gap-2">
            {([['overall','Overall OD Records'],['today','Today'],['upcoming','Upcoming']] as [ReportTab, string][]).map(([tab, label]) => <button key={tab} onClick={() => setReportTab(tab)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${reportTab === tab ? 'bg-[#1678ed] text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>{label}</button>)}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <button onClick={() => setReportTab('overall')} className={`rounded-lg p-4 text-left transition ${reportTab === 'overall' ? 'ring-2 ring-blue-400' : ''} bg-blue-50`}><p className="text-xs font-bold">Overall OD Records</p><p className="mt-2 text-3xl font-bold">{ods.length}</p></button>
            <button onClick={() => setReportTab('today')} className={`rounded-lg p-4 text-left transition ${reportTab === 'today' ? 'ring-2 ring-emerald-400' : ''} bg-emerald-50`}><p className="text-xs font-bold">Today</p><p className="mt-2 text-3xl font-bold">{todayOds.length}</p></button>
            <button onClick={() => setReportTab('upcoming')} className={`rounded-lg p-4 text-left transition ${reportTab === 'upcoming' ? 'ring-2 ring-orange-400' : ''} bg-orange-50`}><p className="text-xs font-bold">Upcoming</p><p className="mt-2 text-3xl font-bold">{upcomingOds}</p></button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#dce7f5] bg-white shadow-sm">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[1.2fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr] bg-[#f7faff] px-5 py-2 text-[10px] font-bold uppercase text-[#58749d]"><span>Student Name</span><span>Roll No</span><span>Event</span><span>College</span><span>Type</span><span>OD Period</span></div>
              {(reportTab === 'overall' ? ods : reportTab === 'today' ? todayOds : ods.filter(o => o.od_date > todayKey)).length === 0
                ? <p className="p-8 text-center text-sm text-slate-400">No records to display.</p>
                : (reportTab === 'overall' ? ods : reportTab === 'today' ? todayOds : ods.filter(o => o.od_date > todayKey)).map(od => <div key={od.id} className="grid grid-cols-[1.2fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr] items-center border-t border-[#edf2f8] px-5 py-3 text-[11px] text-[#385579]"><span className="font-semibold text-[#24436d]">{od.student_name}</span><span>{od.roll_number}</span><span>{od.reason || 'On-Duty'}</span><span>{od.college_name || '—'}</span><span><b className="rounded-full bg-blue-100 px-2 py-1 text-[10px] text-blue-700">{od.category === 'inter_college' ? 'Inter-College' : 'Other College'}</b></span><span>{fmtDate(od.od_date)}{od.od_end_date ? ` → ${fmtDate(od.od_end_date)}` : ''}</span></div>)}
            </div>
          </div>
        </section>}

        {navView === 'approvals' && <div className="space-y-4">
          {advisorError && <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{advisorError}</p>}
          <div className="overflow-x-auto rounded-xl border border-[#dce7f5] bg-white shadow-sm">
            <table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-[#f7faff] uppercase text-[#58749d]"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Register No.</th><th className="px-4 py-3">From Date</th><th className="px-4 py-3">To Date</th><th className="px-4 py-3">College</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>{requests.map(request => { const student = request.students; return <tr key={request.id} className="border-t border-[#edf2f8] align-top"><td className="px-4 py-4 font-semibold">{student?.name ?? 'Unknown student'}</td><td className="px-4 py-4">{student?.register_number ?? '—'}</td><td className="px-4 py-4">{fmtDate(request.od_date)}</td><td className="px-4 py-4">{request.od_end_date ? fmtDate(request.od_end_date) : '—'}</td><td className="px-4 py-4">{request.college_name ?? '—'}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${request.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700' : request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{request.status}</span></td><td className="px-4 py-4">{request.status === 'Pending Approval' ? <div className="min-w-[180px] space-y-2"><input value={comment[request.id] ?? ''} onChange={e => setComment(prev => ({ ...prev, [request.id]: e.target.value }))} placeholder="Optional comment" className="w-full rounded border border-[#d5e1f1] px-2 py-1.5 outline-none focus:border-[#2279e8]" /><div className="flex gap-2"><button disabled={busy === request.id} onClick={() => decide(request.id, 'approve_od_request')} className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1.5 font-bold text-white"><Check className="h-3 w-3" />Approve</button><button disabled={busy === request.id} onClick={() => decide(request.id, 'reject_od_request')} className="flex items-center gap-1 rounded bg-red-600 px-2 py-1.5 font-bold text-white"><X className="h-3 w-3" />Reject</button></div></div> : <span className="text-[#87a2c8]">{request.advisor_comment || 'Completed'}</span>}</td></tr>; })}</tbody></table>
            {requests.length === 0 && <p className="p-12 text-center text-sm text-[#87a2c8]">No approval requests yet.</p>}
          </div>
        </div>}

        {navView === 'attendance' && <div className="space-y-4">
          {advisorError && <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{advisorError}</p>}
          {advisorNotice && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">{advisorNotice}</p>}
          <div className="rounded-xl border border-[#dce7f5] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Upload Class Attendance</h2>
            <p className="mt-1 text-sm text-[#52709e]">Upload attendance in any file format (CSV, Excel, or text). Required columns: Name and Register Number. Optional: Department, Class/Section, and Attendance Percentage. Matching register numbers update existing records — no duplicates are created.</p>
            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-6 py-12 text-center">
              {uploading ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> : <Upload className="h-8 w-8 text-blue-600" />}
              <span className="mt-3 text-sm font-bold text-blue-700">{uploading ? 'Processing file...' : 'Choose attendance file'}</span>
              <span className="mt-1 text-xs text-[#52709e]">CSV, XLS, XLSX, TXT, or any text-based format</span>
              <input type="file" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>}

        {navView === 'students' && <div className="space-y-4">
          {advisorError && <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{advisorError}</p>}
          <div className="overflow-x-auto rounded-xl border border-[#dce7f5] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#e5edf7] px-5 py-4"><CalendarClock className="h-5 w-5 text-[#173e78]" /><h2 className="text-sm font-bold">Student Details & OD Summary</h2></div>
            <table className="min-w-[800px] w-full text-left text-xs"><thead className="bg-[#f7faff] text-[#58749d]"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Register No.</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">This Month OD</th><th className="px-4 py-3">Total OD</th></tr></thead>
            <tbody>{students.map(s => <tr key={s.id} className="border-t border-[#edf2f8]"><td className="px-4 py-3 font-semibold">{s.name}</td><td className="px-4 py-3">{s.register_number}</td><td className="px-4 py-3">{s.department || '—'}{s.class_section ? ` · ${s.class_section}` : ''}</td><td className="px-4 py-3">{s.attendance_percentage ?? '—'}%</td><td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{s.month_od}</span></td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{s.total_od}</span></td></tr>)}</tbody></table>
            {students.length === 0 && <p className="p-10 text-center text-sm text-[#87a2c8]">No students yet. Students who register an OD will appear here automatically. Upload attendance to add their attendance percentage.</p>}
          </div>
        </div>}
      </main>

      <RegisterModal date={registerDate} allOds={ods} onClose={() => setRegisterDate(null)} onRegistered={() => { setRegisterDate(null); fetchOds(); }} />
      {calendarDate && <CalendarDateModal date={calendarDate} ods={ods} onClose={() => setCalendarDate(null)} />}
    </div>
  </div>;
}

function CalendarDateModal({ date, ods, onClose }: { date: Date; ods: OdRegistration[]; onClose: () => void }) {
  const key = dateKey(date);
  const dayOds = ods.filter(o => { const end = o.od_end_date ?? o.od_date; return key >= o.od_date && key <= end; });
  const otherCount = dayOds.filter(o => o.category === 'other_college').length;
  const interCount = dayOds.filter(o => o.category === 'inter_college').length;
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13284b]/30 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#dce7f5] overflow-hidden animate-[slideUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5edf7]">
          <div>
            <h3 className="text-base font-bold text-[#13284b]">OD Details</h3>
            <p className="text-xs text-[#87a2c8] mt-0.5">{dateStr}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#87a2c8] hover:text-[#13284b] hover:bg-slate-100 transition-colors active:scale-90" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center"><p className="text-[10px] font-bold text-blue-700">Other College</p><p className="text-lg font-bold text-blue-700">{otherCount}</p></div>
            <div className="flex-1 rounded-lg bg-fuchsia-50 p-3 text-center"><p className="text-[10px] font-bold text-fuchsia-700">Inter College</p><p className="text-lg font-bold text-fuchsia-700">{interCount}</p></div>
            <div className="flex-1 rounded-lg bg-slate-50 p-3 text-center"><p className="text-[10px] font-bold text-slate-700">Total</p><p className="text-lg font-bold text-slate-700">{dayOds.length}</p></div>
          </div>
          {dayOds.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No students on OD for this date.</p> : (
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr] bg-[#f7faff] px-4 py-2 text-[10px] font-bold uppercase text-[#58749d]"><span>Student Name</span><span>Roll No</span><span>Reason</span><span>Type</span></div>
                {dayOds.map(od => <div key={od.id} className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr] items-center border-t border-[#edf2f8] px-4 py-3 text-[11px] text-[#385579]"><span className="font-semibold text-[#24436d]">{od.student_name}</span><span>{od.roll_number}</span><span>{od.reason || 'On-Duty'}</span><span><b className="rounded-full bg-blue-100 px-2 py-1 text-[10px] text-blue-700">{od.category === 'inter_college' ? 'Inter' : 'Other'}</b></span></div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/advisor/login') return <PrivateLogin role="advisor" />;
  if (path === '/advisor' || path.startsWith('/advisor/')) return <ProtectedStaff role="advisor">{profile => <MainDashboard profile={profile} />}</ProtectedStaff>;
  return <MainDashboard profile={null} />;
}
