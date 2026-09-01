'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Home, Briefcase, CheckCircle } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { PendingRouting } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const DRAWER_OPTIONS: { id: 'personal' | 'home' | 'business'; label: string; icon: typeof User; desc: string }[] = [
  { id: 'personal', label: 'Me', icon: User, desc: 'This is my personal mail' },
  { id: 'home', label: 'My Household', icon: Home, desc: 'Shared household mail' },
  { id: 'business', label: 'My Business', icon: Briefcase, desc: 'Business or company mail' },
];

function DisambiguateContent() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDrawer, setSelectedDrawer] = useState<'personal' | 'home' | 'business' | null>(null);
  const [addAlias, setAddAlias] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    api.mailboxV2.getPendingRouting()
      .then(result => setPending(result.pending || []))
      .catch(() => toast.error('Failed to load pending routing'))
      .finally(() => setLoading(false));
  }, []);

  const current = pending[currentIndex];

  const handleResolve = async () => {
    if (!current || !selectedDrawer) return;
    setResolving(true);
    try {
      await api.mailboxV2.resolveRouting({
        mailId: current.mail_id,
        drawer: selectedDrawer,
        addAlias,
        aliasString: addAlias ? current.recipient_name_raw : undefined,
      });
      if (currentIndex < pending.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedDrawer(null);
        setAddAlias(false);
      } else {
        router.back();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resolve routing');
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!current) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Disambiguate</h1>
      </div>
      <div className="text-center py-16">
        <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
        <p className="text-lg font-semibold text-app-text">All clear</p>
        <p className="text-sm text-app-text-secondary mt-1">No items need routing.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Disambiguate</h1>
        </div>
        <span className="text-sm text-app-text-secondary font-semibold">{currentIndex + 1} of {pending.length}</span>
      </div>

      <h2 className="text-lg font-bold text-app-text mb-2">Who is this mail for?</h2>
      <p className="text-sm text-app-text-secondary mb-3">We received mail addressed to:</p>

      {/* Name card */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4 text-center">
        <p className="text-lg font-bold text-app-text">&ldquo;{current.recipient_name_raw}&rdquo;</p>
        <p className="text-xs text-app-text-muted mt-1">at your address</p>
      </div>

      {/* Mail preview */}
      {current.Mail && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-app-text">{current.Mail.sender_display || 'Unknown sender'}</p>
          <p className="text-xs text-app-text-secondary mt-1 line-clamp-2">
            {(current.Mail as any).preview_text || (current.Mail as any).content || current.Mail.subject || ''}
          </p>
        </div>
      )}

      {/* Drawer options */}
      <p className="text-[11px] font-bold tracking-wider text-app-text-muted mb-3">IS THIS FOR:</p>
      <div className="space-y-2 mb-4">
        {DRAWER_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const selected = selectedDrawer === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedDrawer(opt.id)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition text-left ${
                selected
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-transparent bg-app-surface hover:bg-app-hover'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selected ? 'border-emerald-600' : 'border-app-border'
              }`}>
                {selected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
              </div>
              <Icon className={`w-4.5 h-4.5 ${selected ? 'text-app-text' : 'text-app-text-muted'}`} />
              <div className="flex-1">
                <p className={`text-sm ${selected ? 'font-bold text-app-text' : 'font-medium text-app-text'}`}>{opt.label}</p>
                <p className="text-xs text-app-text-muted">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Alias toggle */}
      {selectedDrawer === 'personal' && (
        <label className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={addAlias}
            onChange={e => setAddAlias(e.target.checked)}
            className="w-4 h-4 rounded border-app-border text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <p className="text-sm font-semibold text-app-text">Add &ldquo;{current.recipient_name_raw}&rdquo; as my alias</p>
            <p className="text-xs text-app-text-secondary">So future mail with this name routes automatically</p>
          </div>
        </label>
      )}

      {/* Route button */}
      <button
        onClick={handleResolve}
        disabled={!selectedDrawer || resolving}
        className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-40 transition"
      >
        {resolving ? 'Routing...' : 'Route it'}
      </button>
    </div>
  );
}

export default function DisambiguatePage() { return <Suspense><DisambiguateContent /></Suspense>; }
