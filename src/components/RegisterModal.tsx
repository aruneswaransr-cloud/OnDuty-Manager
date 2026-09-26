import { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Loader2, Building2, School, Calendar, MapPin } from 'lucide-react';
import { supabase, type OdCategory, type OdRegistration, CATEGORY_LIMITS, CATEGORY_LABELS } from '@/lib/supabase';

interface RegisterModalProps {
  date: Date | null;
  allOds: OdRegistration[];
  onClose: () => void;
  onRegistered: () => void;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toInputDate(d: Date) {
  return dateKey(d);
}

function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function RegisterModal({ date, allOds, onClose, onRegistered }: RegisterModalProps) {
  const [fromDate, setFromDate] = useState<Date>(date ?? new Date());
  const [toDate, setToDate] = useState<Date>(date ?? new Date());
  const [studentName, setStudentName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [category, setCategory] = useState<OdCategory>('other_college');
  const [reason, setReason] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (date) {
      setFromDate(date);
      setToDate(date);
      setStudentName('');
      setRollNumber('');
      setCategory('other_college');
      setReason('');
      setCollegeName('');
      setError(null);
      setSuccess(false);
    }
  }, [date]);

  if (!date) return null;

  const fromKey = dateKey(fromDate);
  const toKey = dateKey(toDate);
  const isRange = fromKey !== toKey;
  const dateStr = isRange
    ? `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : fromDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const dateOds = allOds.filter(o => {
    const oStart = o.od_date;
    const oEnd = o.od_end_date ?? o.od_date;
    return oStart <= toKey && oEnd >= fromKey;
  });
  const otherCount = dateOds.filter(o => o.category === 'other_college').length;
  const interCount = dateOds.filter(o => o.category === 'inter_college').length;
  const currentCount = category === 'other_college' ? otherCount : interCount;
  const limit = CATEGORY_LIMITS[category];
  const isFull = currentCount >= limit;

  const dateInvalid = toDate < fromDate;

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = fromInputDate(e.target.value);
    setFromDate(d);
    if (d > toDate) setToDate(d);
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToDate(fromInputDate(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dateInvalid) {
      setError('The end date cannot be before the start date.');
      return;
    }
    if (!studentName.trim() || !rollNumber.trim()) {
      setError('Please fill in your name and roll number.');
      return;
    }
    if (category === 'other_college' && !collegeName.trim()) {
      setError('Please enter the college name you are attending.');
      return;
    }
    if (isFull) {
      setError(`The limit for ${CATEGORY_LABELS[category]} has been reached (${limit} students).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('ods').insert({
      student_name: studentName.trim(),
      roll_number: rollNumber.trim(),
      category,
      od_date: dateKey(fromDate),
      od_end_date: isRange ? dateKey(toDate) : null,
      reason: reason.trim(),
      college_name: category === 'other_college' ? collegeName.trim() : null,
    });

    setSubmitting(false);

    if (insertError) {
      setError('Something went wrong. Please try again.');
      return;
    }

    setSuccess(true);
    setTimeout(() => onRegistered(), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13284b]/30 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#dce7f5] overflow-hidden animate-[slideUp_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5edf7]">
          <div>
            <h3 className="text-base font-bold text-[#13284b]">Register On Duty</h3>
            <p className="text-xs text-[#87a2c8] mt-0.5">{dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#87a2c8] hover:text-[#13284b] hover:bg-slate-100 transition-colors active:scale-90"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-14 px-6">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-base font-bold text-[#13284b]">OD Registered</p>
            <p className="text-xs text-[#87a2c8] mt-1">Your on-duty has been saved successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* From / To date pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#385579] mb-1.5">From Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#87a2c8] pointer-events-none" />
                  <input
                    type="date"
                    value={toInputDate(fromDate)}
                    onChange={handleFromDateChange}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#13284b]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#385579] mb-1.5">To Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#87a2c8] pointer-events-none" />
                  <input
                    type="date"
                    value={toInputDate(toDate)}
                    onChange={handleToDateChange}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none transition-all text-sm text-[#13284b] ${
                      dateInvalid
                        ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100'
                        : 'border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100'
                    }`}
                  />
                </div>
              </div>
            </div>
            {dateInvalid && (
              <p className="text-[11px] font-medium text-red-600 -mt-2">End date must be on or after the start date.</p>
            )}

            {/* Category selector */}
            <div>
              <label className="block text-xs font-semibold text-[#385579] mb-1.5">Category</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCategory('other_college')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border transition-all
                    ${category === 'other_college'
                      ? 'border-[#1678ed] bg-blue-50'
                      : 'border-[#d5e1f1] bg-white hover:border-[#2279e8]'}`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${category === 'other_college' ? 'text-blue-600' : 'text-[#87a2c8]'}`} />
                  <div className="text-left">
                    <span className={`block text-xs font-bold ${category === 'other_college' ? 'text-[#13284b]' : 'text-[#87a2c8]'}`}>
                      Other College
                    </span>
                    <span className="block text-[10px] text-[#87a2c8]">
                      {otherCount}/{CATEGORY_LIMITS.other_college} slots
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('inter_college')}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border transition-all
                    ${category === 'inter_college'
                      ? 'border-[#1678ed] bg-fuchsia-50'
                      : 'border-[#d5e1f1] bg-white hover:border-[#2279e8]'}`}
                >
                  <School className={`w-4 h-4 shrink-0 ${category === 'inter_college' ? 'text-fuchsia-600' : 'text-[#87a2c8]'}`} />
                  <div className="text-left">
                    <span className={`block text-xs font-bold ${category === 'inter_college' ? 'text-[#13284b]' : 'text-[#87a2c8]'}`}>
                      Inter College
                    </span>
                    <span className="block text-[10px] text-[#87a2c8]">
                      {interCount}/{CATEGORY_LIMITS.inter_college} slots
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Capacity bar */}
            <div className="flex items-center gap-2 text-[11px] text-[#58749d]">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isFull ? 'bg-red-400' : category === 'other_college' ? 'bg-blue-400' : 'bg-fuchsia-400'}`}
                  style={{ width: `${Math.min(100, (currentCount / limit) * 100)}%` }}
                />
              </div>
              <span className="font-semibold whitespace-nowrap tabular-nums">{currentCount}/{limit}</span>
            </div>

            {/* College name — only for Other College */}
            {category === 'other_college' && (
              <div>
                <label className="block text-xs font-semibold text-[#385579] mb-1.5">
                  College Name <span className="text-red-500 font-normal">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#87a2c8] pointer-events-none" />
                  <input
                    type="text"
                    value={collegeName}
                    onChange={e => setCollegeName(e.target.value)}
                    placeholder="Enter the college you are attending"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#13284b] placeholder:text-[#87a2c8]"
                  />
                </div>
              </div>
            )}

            {/* Limit warning */}
            {isFull && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100 animate-[shake_0.3s_ease-out]">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-px" />
                <p className="text-xs font-medium text-red-700 leading-relaxed">
                  {CATEGORY_LABELS[category]} limit reached ({limit} students). Choose a different category or date.
                </p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-[#385579] mb-1.5">Student Name</label>
              <input
                type="text"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Enter full name"
                className="w-full px-3 py-2.5 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#13284b] placeholder:text-[#87a2c8]"
              />
            </div>

            {/* Roll number */}
            <div>
              <label className="block text-xs font-semibold text-[#385579] mb-1.5">Roll Number</label>
              <input
                type="text"
                value={rollNumber}
                onChange={e => setRollNumber(e.target.value)}
                placeholder="e.g. 21CS101"
                className="w-full px-3 py-2.5 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#13284b] placeholder:text-[#87a2c8]"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-[#385579] mb-1.5">
                Reason <span className="text-[#87a2c8] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Hackathon, Symposium, Sports meet"
                className="w-full px-3 py-2.5 rounded-lg border border-[#d5e1f1] focus:border-[#2279e8] focus:ring-1 focus:ring-blue-100 outline-none transition-all text-sm text-[#13284b] placeholder:text-[#87a2c8]"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-px" />
                <p className="text-xs font-medium text-red-700 leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || isFull || dateInvalid}
              className="w-full py-2.5 rounded-lg bg-[#1678ed] text-white text-sm font-semibold hover:bg-[#0d67d4] transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register OD'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
