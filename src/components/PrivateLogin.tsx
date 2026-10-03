import { FormEvent, useState } from 'react';
import { GraduationCap, Loader2, ShieldCheck } from 'lucide-react';
import { supabase, type StaffRole } from '@/lib/supabase';

interface PrivateLoginProps {
  role: StaffRole;
}

export default function PrivateLogin({ role }: PrivateLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const roleLabel = role === 'admin' ? 'Admin' : 'Advisor';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      setError('The email or password was not accepted.');
      return;
    }
    window.location.href = role === 'admin' ? '/admin' : '/advisor';
  };

  return (
    <main className="min-h-screen bg-[#f4f8fd] px-4 py-12 text-[#13284b]">
      <div className="mx-auto max-w-md rounded-2xl border border-[#dce7f5] bg-white p-8 shadow-xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2868ed] text-white"><GraduationCap className="h-6 w-6" /></div>
          <div><p className="text-sm font-bold">College OD Management</p><p className="text-xs text-[#87a2c8]">Private {roleLabel} access</p></div>
        </div>
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"><ShieldCheck className="h-4 w-4" /> Authorized staff only</div>
        <h1 className="text-2xl font-bold">{roleLabel} Login</h1>
        <p className="mt-1 text-sm text-[#52709e]">Sign in to continue to the private {roleLabel.toLowerCase()} workspace.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold text-[#385579]">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d5e1f1] px-3 py-2.5 text-sm outline-none focus:border-[#2279e8]" /></label>
          <label className="block text-xs font-semibold text-[#385579]">Password<input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d5e1f1] px-3 py-2.5 text-sm outline-none focus:border-[#2279e8]" /></label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1678ed] py-3 text-sm font-bold text-white hover:bg-[#0d67d4] disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign In</button>
        </form>
      </div>
    </main>
  );
}
