import { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap, Plus, Bell, LayoutDashboard, FileText, BarChart3,
  CalendarRange, Search, ChevronRight, Users, Building2, School, CalendarClock,
} from 'lucide-react';
import { supabase, type OdRegistration } from '@/lib/supabase';
import Calendar from '@/components/Calendar';
import RegisterModal from '@/components/RegisterModal';
import OdList from '@/components/OdList';

type ListFilter = 'all' | 'past' | 'future';
type NavView = 'dashboard' | 'calendar' | 'records' | 'reports';

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const [ods, setOds] = useState<OdRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerDate, setRegisterDate] = useState<Date | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [navView, setNavView] = useState<NavView>('dashboard');

  const fetchOds = useCallback(async () => {
    const { data, error } = await supabase
      .from('ods')
      .select('*')
      .order('od_date', { ascending: true });
    if (error) {
      console.error('Failed to fetch ODs:', error);
      return;
    }
    setOds((data ?? []) as OdRegistration[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOds();
  }, [fetchOds]);

  const handleDelete = async (id: string) => {
    setOds(prev => prev.filter(o => o.id !== id));
    await supabase.from('ods').delete().eq('id', id);
    fetchOds();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);

  const todayOds = ods.filter(o => {
    const start = o.od_date;
    const end = o.od_end_date ?? o.od_date;
    return start <= todayKey && end >= todayKey;
  });
  const upcomingOds = ods.filter(o => o.od_date > todayKey).length;
  const otherToday = todayOds.filter(o => o.category === 'other_college').length;
  const interToday = todayOds.filter(o => o.category === 'inter_college').length;

  const upcomingList = ods.filter(o => o.od_date > todayKey).slice(0, 4);
  const recentRegistrations = [...ods].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  const cards = [
    { label: "Today's OD", value: String(todayOds.length), note: 'students going on OD today', icon: Users, color: 'blue' },
    { label: 'Other College', value: `${otherToday} / 10`, note: `${10 - otherToday} slots available`, icon: Building2, color: 'green' },
    { label: 'Inter-College', value: `${interToday} / 5`, note: `${5 - interToday} slots available`, icon: School, color: 'purple' },
    { label: 'Upcoming OD', value: String(upcomingOds), note: 'students with upcoming OD', icon: CalendarClock, color: 'orange' },
  ];

  const cardStyles: Record<string, string> = {
    blue: 'border-blue-100 bg-blue-50/40 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50/40 text-emerald-700',
    purple: 'border-fuchsia-100 bg-fuchsia-50/40 text-fuchsia-700',
    orange: 'border-orange-100 bg-orange-50/50 text-orange-700',
  };

  const navItems: { label: string; icon: typeof LayoutDashboard; view: NavView | 'register' }[] = [
    { label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
    { label: 'OD Calendar', icon: CalendarRange, view: 'calendar' },
    { label: 'Register OD', icon: Plus, view: 'register' },
    { label: 'OD Records', icon: FileText, view: 'records' },
    { label: 'Reports', icon: BarChart3, view: 'reports' },
  ];

  const handleNavClick = (item: typeof navItems[number]) => {
    if (item.view === 'register') {
      setRegisterDate(new Date());
    } else {
      setNavView(item.view);
    }
  };

  const viewTitles: Record<NavView, { title: string; subtitle: string }> = {
    dashboard: { title: 'College On-Duty Management', subtitle: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) },
    calendar: { title: 'OD Calendar', subtitle: 'Click any date to register an OD for that day' },
    records: { title: 'OD Records', subtitle: 'Search, filter, and manage all registered on-duty records' },
    reports: { title: 'Reports', subtitle: 'Summary statistics and capacity utilization' },
  };

  const currentTitle = viewTitles[navView];

  return (
    <div className="min-h-screen bg-[#f4f8fd] text-[#13284b]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 bg-[#102443] text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2868ed] text-white shadow-lg shadow-blue-900/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">College OD</p>
            <p className="text-sm font-bold leading-tight">Management</p>
          </div>
        </div>
        <nav className="space-y-2 px-3 py-6">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = item.view !== 'register' && item.view === navView;
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#1478ed] text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 px-5 py-5 text-[11px] text-slate-300">
          <p className="font-semibold text-white">College On-Duty Management</p>
          <p className="mt-1">Plan · Register · Go Forward</p>
        </div>
      </aside>

      <div className="lg:pl-56">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#13284b]">{currentTitle.title}</h1>
              <p className="text-xs text-[#52709e]">{currentTitle.subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#87a2c8]" />
                <input
                  className="w-64 rounded-lg border border-[#d5e1f1] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#2279e8]"
                  placeholder="Search by name, roll number, event or college..."
                />
              </div>
              <button className="relative rounded-lg p-2 text-[#17345d] hover:bg-slate-100" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>
              <button
                onClick={() => setRegisterDate(new Date())}
                className="flex items-center gap-2 rounded-lg bg-[#1678ed] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d67d4]"
              >
                <Plus className="h-4 w-4" />
                Register OD
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] space-y-5 p-5 lg:p-7">
          {/* DASHBOARD VIEW */}
          {navView === 'dashboard' && (
            <>
              {/* Stat cards */}
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${cardStyles[card.color]}`}>
                      <div className="flex items-start justify-between">
                        <div className="rounded-full bg-white/70 p-3">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{card.color === 'orange' ? 'Upcoming' : 'Available'}</span>
                      </div>
                      <p className="mt-2 text-xs font-bold text-[#18345f]">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold text-[#122b52]">{card.value}</p>
                      <p className="text-[11px] text-[#55739d]">{card.note}</p>
                      {card.color === 'blue' && <p className="mt-2 text-xs font-bold text-emerald-600">↑ +2 from yesterday</p>}
                      {card.color === 'green' && <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, otherToday * 10)}%` }} /></div>}
                      {card.color === 'purple' && <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, interToday * 20)}%` }} /></div>}
                    </div>
                  );
                })}
              </section>

              {/* Main content grid */}
              <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
                {/* Left column */}
                <div className="space-y-5">
                  {/* Today's students table */}
                  <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#e5edf7] px-5 py-4">
                      <h2 className="flex items-center gap-2 text-sm font-bold">
                        <Users className="h-5 w-5 text-[#173e78]" />
                        Today's On-Duty Students
                      </h2>
                      <button
                        onClick={() => setNavView('records')}
                        className="flex items-center gap-1 rounded-lg border border-blue-100 px-3 py-1.5 text-[11px] font-bold text-blue-600"
                      >
                        View All Today's OD
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[680px]">
                        <div className="grid grid-cols-[1.2fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr] bg-[#f7faff] px-5 py-2 text-[10px] font-bold uppercase text-[#58749d]">
                          <span>Student Name</span>
                          <span>Roll No</span>
                          <span>Event</span>
                          <span>College</span>
                          <span>Type</span>
                          <span>OD Period</span>
                        </div>
                        {todayOds.length === 0 ? (
                          <p className="p-8 text-center text-sm text-slate-400">No students registered for today yet.</p>
                        ) : (
                          todayOds.slice(0, 6).map(od => {
                            const isRange = od.od_end_date && od.od_end_date !== od.od_date;
                            return (
                              <div
                                key={od.id}
                                className="grid grid-cols-[1.2fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr] items-center border-t border-[#edf2f8] px-5 py-3 text-[11px] text-[#385579]"
                              >
                                <span className="font-semibold text-[#24436d]">{od.student_name}</span>
                                <span>{od.roll_number}</span>
                                <span>{od.reason || 'On-Duty'}</span>
                                <span>{od.category === 'inter_college' ? 'Inter-College' : (od.college_name || 'Other College')}</span>
                                <span>
                                  <b className={`rounded-full px-2 py-1 text-[10px] ${od.category === 'inter_college' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {od.category === 'inter_college' ? 'Inter-College' : 'Other College'}
                                  </b>
                                </span>
                                <span>{isRange ? `${od.od_date} → ${od.od_end_date}` : od.od_date}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Calendar */}
                  <Calendar ods={ods} onDateClick={setRegisterDate} />
                </div>

                {/* Right column */}
                <div className="space-y-5">
                  {/* Daily capacity */}
                  <div className="rounded-xl border border-[#dce7f5] bg-white p-4 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                      <BarChart3 className="h-5 w-5 text-[#173e78]" />
                      Daily Capacity
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                        <p className="text-xs font-bold">Other College OD</p>
                        <p className="mt-1 text-xl font-bold">{otherToday} / 10</p>
                        <div className="mt-2 h-1.5 rounded-full bg-blue-100">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, otherToday * 10)}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">{10 - otherToday} slots remaining</p>
                      </div>
                      <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/40 p-4">
                        <p className="text-xs font-bold">Inter-College OD</p>
                        <p className="mt-1 text-xl font-bold">{interToday} / 5</p>
                        <div className="mt-2 h-1.5 rounded-full bg-fuchsia-100">
                          <div className="h-full rounded-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, interToday * 20)}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">{5 - interToday} slots remaining</p>
                      </div>
                    </div>
                  </div>

                  {/* Upcoming OD */}
                  <div className="rounded-xl border border-[#dce7f5] bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold">
                        <CalendarClock className="h-5 w-5 text-[#173e78]" />
                        Upcoming On-Duty
                      </h2>
                      <button
                        onClick={() => setNavView('records')}
                        className="flex items-center text-[11px] font-bold text-blue-600"
                      >
                        View All <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {upcomingList.length > 0 ? (
                        upcomingList.map(od => (
                          <button
                            key={od.id}
                            onClick={() => setRegisterDate(new Date(`${od.od_date}T00:00:00`))}
                            className="flex w-full items-center gap-3 rounded-lg border border-[#edf2f8] p-2 text-left hover:bg-blue-50"
                          >
                            <span className="rounded-lg bg-blue-50 px-2 py-1 text-center text-[10px] font-bold text-blue-700">
                              {od.od_date.slice(5).replace('-', '/')}
                            </span>
                            <span className="min-w-0 flex-1">
                              <b className="block truncate text-[11px]">{od.reason || 'On-Duty'}</b>
                              <small className="text-[10px] text-slate-500">
                                {od.student_name} · {od.category === 'inter_college' ? 'Inter-College' : 'Other College'}
                              </small>
                            </span>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                          </button>
                        ))
                      ) : (
                        <p className="py-6 text-center text-xs text-slate-400">No upcoming ODs.</p>
                      )}
                    </div>
                  </div>

                  {/* Recent registrations */}
                  <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#e5edf7] px-5 py-4">
                      <h2 className="flex items-center gap-2 text-sm font-bold"><FileText className="h-5 w-5 text-[#173e78]" />Recent Registrations</h2>
                      <button onClick={() => setNavView('records')} className="flex items-center text-[11px] font-bold text-blue-600">View All Records <ChevronRight className="h-3 w-3" /></button>
                    </div>
                    <div className="grid grid-cols-[1fr_0.8fr_1fr_1fr] bg-[#f7faff] px-5 py-2 text-[10px] font-bold uppercase text-[#58749d]"><span>Student</span><span>Roll No</span><span>Event</span><span>College</span></div>
                    {recentRegistrations.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No registrations yet.</p> : recentRegistrations.map(od => <div key={od.id} className="grid grid-cols-[1fr_0.8fr_1fr_1fr] items-center border-t border-[#edf2f8] px-5 py-3 text-[11px] text-[#385579]"><span className="truncate font-semibold text-[#24436d]">{od.student_name}</span><span>{od.roll_number}</span><span className="truncate">{od.reason || 'On-Duty'}</span><span className="truncate">{od.college_name || (od.category === 'inter_college' ? 'Inter-College' : 'Other College')}</span></div>)}
                  </div>

                  {/* Quick actions */}
                  <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-[#e5edf7] px-5 py-4 text-sm font-bold"><span className="text-xl leading-none text-blue-600">ϟ</span>Quick Actions</div>
                    <div className="grid grid-cols-2 gap-3 p-5"><button onClick={() => setRegisterDate(new Date())} className="flex items-center justify-center gap-2 rounded-lg bg-[#2868ed] px-3 py-3 text-xs font-bold text-white transition hover:bg-blue-700"><Plus className="h-4 w-4" />Register OD</button><button onClick={() => setNavView('calendar')} className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-3 text-xs font-bold text-blue-600 transition hover:bg-blue-50"><CalendarRange className="h-4 w-4" />View Calendar</button></div>
                  </div>
                </div>
              </section>

              {/* OD list with filter tabs */}
              <section className="hidden space-y-4">
                <div className="flex items-center gap-2">
                  {(['all', 'past', 'future'] as ListFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setListFilter(f)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        listFilter === f
                          ? 'bg-[#1678ed] text-white'
                          : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      {f === 'all' ? 'All ODs' : f === 'past' ? 'Past' : 'Upcoming'}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-12 flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-slate-200 border-t-[#1678ed] rounded-full animate-spin" />
                  </div>
                ) : (
                  <OdList ods={ods} filter={listFilter} onDelete={handleDelete} />
                )}
              </section>
            </>
          )}

          {/* CALENDAR VIEW */}
          {navView === 'calendar' && (
            <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
              <Calendar ods={ods} onDateClick={setRegisterDate} />
              <div className="space-y-5">
                <div className="rounded-xl border border-[#dce7f5] bg-white p-5 shadow-sm">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Plus className="h-5 w-5 text-[#173e78]" />
                    Quick Register
                  </h2>
                  <p className="text-xs text-[#55739d] mb-4 leading-relaxed">
                    Click any date on the calendar to register an OD for that day. Other College allows up to 10 students per day; Inter College allows up to 5.
                  </p>
                  <button
                    onClick={() => setRegisterDate(new Date())}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1678ed] text-white text-sm font-semibold hover:bg-[#0d67d4] transition-colors active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Register OD for Today
                  </button>
                </div>
                <div className="rounded-xl border border-[#dce7f5] bg-white p-5 shadow-sm">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <BarChart3 className="h-5 w-5 text-[#173e78]" />
                    Daily Capacity
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                      <p className="text-xs font-bold">Other College OD</p>
                      <p className="mt-1 text-xl font-bold">{otherToday} / 10</p>
                      <div className="mt-2 h-1.5 rounded-full bg-blue-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, otherToday * 10)}%` }} />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-500">{10 - otherToday} slots remaining</p>
                    </div>
                    <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/40 p-4">
                      <p className="text-xs font-bold">Inter-College OD</p>
                      <p className="mt-1 text-xl font-bold">{interToday} / 5</p>
                      <div className="mt-2 h-1.5 rounded-full bg-fuchsia-100">
                        <div className="h-full rounded-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, interToday * 20)}%` }} />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-500">{5 - interToday} slots remaining</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* RECORDS VIEW */}
          {navView === 'records' && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                {(['all', 'past', 'future'] as ListFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setListFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      listFilter === f
                        ? 'bg-[#1678ed] text-white'
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    {f === 'all' ? 'All ODs' : f === 'past' ? 'Past' : 'Upcoming'}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-slate-200 border-t-[#1678ed] rounded-full animate-spin" />
                </div>
              ) : (
                <OdList ods={ods} filter={listFilter} onDelete={handleDelete} />
              )}
            </section>
          )}

          {/* REPORTS VIEW */}
          {navView === 'reports' && (
            <section className="space-y-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${cardStyles[card.color]}`}>
                      <div className="flex items-start justify-between">
                        <div className="rounded-full bg-white/70 p-3">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{card.color === 'orange' ? 'Upcoming' : 'Available'}</span>
                      </div>
                      <p className="mt-2 text-xs font-bold text-[#18345f]">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold text-[#122b52]">{card.value}</p>
                      <p className="text-[11px] text-[#55739d]">{card.note}</p>
                    </div>
                  );
                })}
              </section>
              <div className="rounded-xl border border-[#dce7f5] bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <BarChart3 className="h-5 w-5 text-[#173e78]" />
                  Capacity Utilization
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-5">
                    <p className="text-sm font-bold">Other College OD</p>
                    <p className="mt-2 text-3xl font-bold">{otherToday} / 10</p>
                    <div className="mt-3 h-2 rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, otherToday * 10)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{10 - otherToday} slots remaining today</p>
                  </div>
                  <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/40 p-5">
                    <p className="text-sm font-bold">Inter-College OD</p>
                    <p className="mt-2 text-3xl font-bold">{interToday} / 5</p>
                    <div className="mt-3 h-2 rounded-full bg-fuchsia-100">
                      <div className="h-full rounded-full bg-fuchsia-500 transition-all" style={{ width: `${Math.min(100, interToday * 20)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{5 - interToday} slots remaining today</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#dce7f5] bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <FileText className="h-5 w-5 text-[#173e78]" />
                  All Records
                </h2>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-7 h-7 border-2 border-slate-200 border-t-[#1678ed] rounded-full animate-spin" />
                  </div>
                ) : (
                  <OdList ods={ods} filter="all" onDelete={handleDelete} />
                )}
              </div>
            </section>
          )}
        </main>

        <footer className="border-t border-slate-200/70 py-6">
          <p className="text-center text-xs text-slate-400 font-medium">
            College On-Duty Management · On-Duty Registration System
          </p>
        </footer>
      </div>

      <RegisterModal
        date={registerDate}
        allOds={ods}
        onClose={() => setRegisterDate(null)}
        onRegistered={() => {
          setRegisterDate(null);
          fetchOds();
        }}
      />
    </div>
  );
}
