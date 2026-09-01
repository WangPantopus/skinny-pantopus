'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import * as api from '@pantopus/api';
import type { SecuritySettings } from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

type OptionKey = 'privacy_mask_level' | 'owner_claim_policy' | 'member_attach_policy';

function OptionGroup({ label, description, options, selected, onSelect, disabled }: {
  label: string;
  description?: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-app-text mb-1">{label}</h3>
      {description && <p className="text-xs text-app-text-secondary mb-3 leading-relaxed">{description}</p>}
      <div className="space-y-2">
        {options.map((opt) => (
          <button key={opt.value} type="button"
            onClick={() => !disabled && onSelect(opt.value)}
            disabled={disabled}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition ${
              selected === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-app-border bg-app-surface'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-app-border'}`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selected === opt.value ? 'border-emerald-500' : 'border-app-border'
            }`}>
              {selected === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
            </div>
            <span className={`text-sm ${selected === opt.value ? 'text-emerald-700 font-semibold' : 'text-app-text-strong'}`}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SecurityContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchSettings = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeOwnership.getSecuritySettings(homeId);
      setSecurity(res.security);
    } catch { toast.error('Failed to load security settings'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchSettings().finally(() => setLoading(false)); }, [fetchSettings]);

  const updateSetting = useCallback(async (key: OptionKey, value: string) => {
    if (!security) return;
    setSaving(true);
    try {
      const res = await api.homeOwnership.updateSecuritySettings(homeId!, { [key]: value } as any);
      if ((res as any)?.pending) {
        toast.info((res as any)?.message || 'This change requires owner approval');
      } else if ((res as any)?.security) {
        setSecurity((res as any).security);
        toast.success('Setting updated');
      }
    } catch (err: any) { toast.error(err?.message || 'Failed to update setting'); }
    finally { setSaving(false); }
  }, [homeId, security]);

  if (loading || !security) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  const claimWindowActive = security.claim_window_active;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Security & Privacy</h1>
      </div>

      {/* Privacy */}
      <OptionGroup
        label="Privacy & Discoverability"
        description="Control how visible your home is to non-members and search."
        options={[
          { value: 'normal', label: 'Normal — discoverable by neighbors' },
          { value: 'high', label: 'Stealth — hidden from search, visible by link only' },
          { value: 'invite_only_discovery', label: 'Invite only — completely hidden' },
        ]}
        selected={security.privacy_mask_level}
        onSelect={(v) => updateSetting('privacy_mask_level', v)}
        disabled={saving}
      />

      {/* Owner claims */}
      <OptionGroup
        label="Owner Claims"
        options={[
          { value: 'open', label: 'Allow — anyone can claim ownership' },
          { value: 'review_required', label: 'Review required — claims need approval' },
        ]}
        selected={security.owner_claim_policy}
        onSelect={(v) => updateSetting('owner_claim_policy', v)}
        disabled={saving || claimWindowActive}
      />

      {claimWindowActive && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-6 -mt-4">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">Claim window is active — owner claim policy cannot be changed until it closes.</p>
        </div>
      )}

      {/* Member attach */}
      <OptionGroup
        label="Member Join Policy"
        options={[
          { value: 'open_invite', label: 'Open invite — anyone with a link can join' },
          { value: 'admin_approval', label: 'Admin approval — join requests need approval' },
          { value: 'verified_only', label: 'Verified only — address verification required' },
        ]}
        selected={security.member_attach_policy}
        onSelect={(v) => updateSetting('member_attach_policy', v)}
        disabled={saving}
      />

      {saving && (
        <div className="flex justify-center py-2">
          <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() { return <Suspense><SecurityContent /></Suspense>; }
