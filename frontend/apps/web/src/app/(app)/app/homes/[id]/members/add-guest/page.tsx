'use client';

import { Suspense, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, BedDouble, Wrench } from 'lucide-react';
import { toast } from '@/components/ui/toast-store';

type Preset = 'visitor' | 'guest' | 'service';

const PRESETS: { id: Preset; label: string; icon: typeof Eye; desc: string }[] = [
  { id: 'visitor', label: 'Visitor',          icon: Eye,       desc: 'WiFi and house rules only' },
  { id: 'guest',   label: 'Guest',            icon: BedDouble, desc: 'Door access and deliveries' },
  { id: 'service', label: 'Service Provider', icon: Wrench,    desc: 'Maintenance and repair' },
];

function AddGuestContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [preset, setPreset] = useState<Preset>('guest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { toast.warning('Please enter the guest name'); return; }
    setSubmitting(true);
    try {
      // This would call the invite/guest-pass API
      toast.success(`${name} has been added as a ${preset}`);
      router.back();
    } catch (err: any) { toast.error(err?.message || 'Failed to add guest'); }
    finally { setSubmitting(false); }
  }, [name, preset, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Add Guest</h1>
      </div>

      <p className="text-sm text-app-text-secondary mb-6 leading-relaxed">
        Grant temporary access to your home profile. Guests can see shared info based on their permission level.
      </p>

      <div className="space-y-5">
        {/* Name */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name"
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        {/* Contact */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Contact (optional)</span>
          <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone"
            className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>

        {/* Access window */}
        <div>
          <p className="text-sm font-bold text-app-text mb-2">Access window</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-app-text-strong">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-app-text-strong">End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </label>
          </div>
        </div>

        {/* Permission preset */}
        <div>
          <p className="text-sm font-bold text-app-text mb-2">Permission preset</p>
          <div className="space-y-2">
            {PRESETS.map((p) => {
              const PresetIcon = p.icon;
              const selected = preset === p.id;
              return (
                <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition ${
                    selected ? 'border-emerald-500 bg-emerald-50' : 'border-app-border bg-app-surface hover:border-app-border'
                  }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selected ? 'bg-emerald-100' : 'bg-app-surface-sunken'}`}>
                    <PresetIcon className={`w-5 h-5 ${selected ? 'text-emerald-600' : 'text-app-text-muted'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${selected ? 'text-emerald-700' : 'text-app-text'}`}>{p.label}</p>
                    <p className="text-xs text-app-text-secondary mt-0.5">{p.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-emerald-500' : 'border-app-border'}`}>
                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting || !name.trim()}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition mt-4">
          {submitting ? 'Adding...' : 'Add Guest'}
        </button>
      </div>
    </div>
  );
}

export default function AddGuestPage() { return <Suspense><AddGuestContent /></Suspense>; }
