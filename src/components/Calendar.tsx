import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OdRegistration } from '@/lib/supabase';

interface CalendarProps {
  ods: OdRegistration[];
  onDateClick: (date: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function odCoversDate(od: OdRegistration, key: string) {
  const start = od.od_date;
  const end = od.od_end_date ?? od.od_date;
  return key >= start && key <= end;
}

export default function Calendar({ ods, onDateClick }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = new Date();

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5edf7]">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#13284b] tracking-tight">
          <CalendarDays className="h-5 w-5 text-[#385579]" />
          OD Calendar
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-[#d5e1f1] text-[#385579] hover:bg-blue-50 transition-colors active:scale-90"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-[#d5e1f1] text-[#385579] hover:bg-blue-50 transition-colors active:scale-90"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-2 rounded-lg border border-[#d5e1f1] text-xs font-semibold text-[#385579] hover:bg-blue-50 transition-colors"
          >
            Today
          </button>
          <span className="hidden sm:flex items-center gap-2 rounded-lg border border-[#d5e1f1] px-3 py-2 text-sm font-semibold text-[#13284b]">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
        </div>
      </div>
      {/* Weekday labels */}
      <div className="grid grid-cols-7 border-b border-[#e5edf7]">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-[11px] font-semibold uppercase tracking-wider text-[#87a2c8] py-2.5">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[88px] bg-slate-50/30 border-b border-r border-slate-50" />;
          const key = dateKey(day);
          const dayOds = ods.filter(o => odCoversDate(o, key));
          const isToday = isSameDay(day, today);
          const otherCount = dayOds.filter(o => o.category === 'other_college').length;
          const interCount = dayOds.filter(o => o.category === 'inter_college').length;

          return (
            <button
              key={i}
              onClick={() => onDateClick(day)}
              className={`group relative min-h-[88px] p-2 border-b border-r border-slate-50 text-left transition-colors duration-150
                ${isToday ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold ${isToday ? 'text-[#1678ed]' : 'text-[#385579]'}`}>
                  {day.getDate()}
                </span>
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1678ed]" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-medium text-[#58749d] truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Other: {otherCount}/15
                </div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-[#58749d] truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Inter: {interCount}/5
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 px-5 py-3 border-t border-[#e5edf7] bg-white text-[11px] text-[#58749d] font-medium">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Available</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Almost Full</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Full</div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-blue-500" />Today</div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-blue-100" />Multi-day Event</div>
      </div>
    </div>
  );
}
