import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
        <h2 className="text-base font-bold text-[#13284b] tracking-tight">
          {MONTHS[currentMonth.getMonth()]} <span className="text-[#87a2c8] font-normal">{currentMonth.getFullYear()}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-[#87a2c8] hover:text-[#13284b] hover:bg-slate-100 transition-colors active:scale-90"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1678ed] hover:bg-blue-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-[#87a2c8] hover:text-[#13284b] hover:bg-slate-100 transition-colors active:scale-90"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
              <div className="space-y-1">
                {otherCount > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 truncate">
                    <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                    {otherCount} OC
                  </div>
                )}
                {interCount > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 truncate">
                    <span className="w-1 h-1 rounded-full bg-fuchsia-500 shrink-0" />
                    {interCount} IC
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-5 py-3 border-t border-[#e5edf7] bg-[#f7faff] text-[11px] text-[#58749d] font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Other College
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
          Inter College
        </div>
      </div>
    </div>
  );
}
