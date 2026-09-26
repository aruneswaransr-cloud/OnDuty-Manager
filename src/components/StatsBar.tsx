import { Users, Building2, School, CalendarClock } from 'lucide-react';
import type { OdRegistration } from '@/lib/supabase';

interface StatsBarProps {
  ods: OdRegistration[];
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StatsBar({ ods }: StatsBarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);

  const todayOds = ods.filter(o => o.od_date === todayKey);
  const todayTotal = todayOds.length;
  const todayOther = todayOds.filter(o => o.category === 'other_college').length;
  const todayInter = todayOds.filter(o => o.category === 'inter_college').length;
  const todayDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKey(tomorrow);
  const tomorrowTotal = ods.filter(o => o.od_date === tomorrowKey).length;
  const tomorrowDate = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const cards = [
    { label: `Today's ODs · ${todayDate}`, value: todayTotal, icon: Users, accent: 'text-slate-900', bg: 'bg-slate-100' },
    { label: 'Other College Today', value: todayOther, icon: Building2, accent: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Inter College Today', value: todayInter, icon: School, accent: 'text-violet-600', bg: 'bg-violet-50' },
    { label: `Tomorrow · ${tomorrowDate}`, value: tomorrowTotal, icon: CalendarClock, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
              <Icon className={`w-4 h-4 ${card.accent}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{card.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
