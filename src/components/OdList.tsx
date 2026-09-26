import { useMemo, useState } from 'react';
import { Trash2, Building2, School, Search, CalendarClock } from 'lucide-react';
import type { OdRegistration } from '@/lib/supabase';
import { CATEGORY_LABELS } from '@/lib/supabase';

interface OdListProps {
  ods: OdRegistration[];
  filter: 'all' | 'past' | 'future';
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatRange(od: OdRegistration) {
  if (od.od_end_date && od.od_end_date !== od.od_date) {
    return `${formatDate(od.od_date)} → ${formatDate(od.od_end_date)}`;
  }
  return formatDate(od.od_date);
}

export default function OdList({ ods, filter, onDelete }: OdListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'other_college' | 'inter_college'>('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    let result = [...ods];
    if (filter === 'past') result = result.filter(o => new Date(o.od_date + 'T00:00:00') < today);
    else if (filter === 'future') result = result.filter(o => new Date(o.od_date + 'T00:00:00') >= today);
    if (categoryFilter !== 'all') result = result.filter(o => o.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.student_name.toLowerCase().includes(q) ||
        o.roll_number.toLowerCase().includes(q) ||
        (o.reason ?? '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const cmp = new Date(a.od_date).getTime() - new Date(b.od_date).getTime();
      return filter === 'past' ? -cmp : cmp;
    });
    return result;
  }, [ods, filter, search, categoryFilter, today]);

  return (
    <div className="rounded-xl border border-[#dce7f5] bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 px-5 py-4 border-b border-[#e5edf7]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#87a2c8]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, Roll Number, or Event..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#13284b] placeholder:text-[#87a2c8]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as 'all' | 'other_college' | 'inter_college')}
          className="px-3 py-2 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#385579] font-medium cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="other_college">Other College</option>
          <option value="inter_college">Inter College</option>
        </select>
        <span className="hidden sm:flex items-center text-sm font-semibold text-[#87a2c8] px-2">
          {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[1fr_120px_160px_180px_40px] gap-3 px-5 py-2.5 bg-[#f7faff] border-b border-[#e5edf7] text-[11px] font-semibold uppercase tracking-wider text-[#58749d]">
        <span>Student</span>
        <span>Roll No.</span>
        <span>Category</span>
        <span>OD Period</span>
        <span />
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-[#edf2f8]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#87a2c8]">
            <CalendarClock className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No ODs found</p>
          </div>
        ) : (
          filtered.map((od, i) => {
            const isPast = new Date(od.od_date + 'T00:00:00') < today;
            const isOther = od.category === 'other_college';
            const isRange = od.od_end_date && od.od_end_date !== od.od_date;
            return (
              <div
                key={od.id}
                className="group grid grid-cols-1 md:grid-cols-[1fr_120px_160px_180px_40px] gap-3 px-5 py-3.5 hover:bg-blue-50/40 transition-colors items-center animate-[slideInRight_0.3s_ease-out_both]"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              >
                {/* Student */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-md shrink-0 ${isOther ? 'bg-blue-50' : 'bg-fuchsia-50'}`}>
                    {isOther ? <Building2 className="w-3.5 h-3.5 text-blue-600" /> : <School className="w-3.5 h-3.5 text-fuchsia-600" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-[#24436d] truncate block">{od.student_name}</span>
                    {isOther && od.college_name && <span className="text-xs text-blue-600 font-medium truncate block">{od.college_name}</span>}
                    {od.reason && <span className="text-xs text-[#87a2c8] truncate block">{od.reason}</span>}
                  </div>
                </div>
                {/* Roll number */}
                <span className="text-sm text-[#385579] font-medium tabular-nums">{od.roll_number}</span>
                {/* Category */}
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOther ? 'bg-blue-50 text-blue-700' : 'bg-fuchsia-50 text-fuchsia-700'}`}>
                    {CATEGORY_LABELS[od.category]}
                  </span>
                  {isPast && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">Past</span>}
                </div>
                {/* Date / Period */}
                <span className={`text-sm text-[#58749d] ${isRange ? 'font-medium' : ''}`}>
                  {formatRange(od)}
                </span>
                {/* Delete */}
                <button
                  onClick={() => onDelete(od.id)}
                  className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 active:scale-90 justify-self-end"
                  aria-label="Delete OD"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
