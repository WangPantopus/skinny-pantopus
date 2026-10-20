'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hub } from '@pantopus/api';
import { BellRing } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { setNotificationPreferences, useNotificationPreferences } from '@/lib/me';

export default function BriefingNotice({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { data: preferences } = useNotificationPreferences();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);
  const active = useRef(true);
  const acknowledged = useRef(false);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (preferences && !preferences.daily_briefing_prompted_at && !attempted.current) {
      attempted.current = true;
      setOpen(true);
    }
  }, [preferences]);

  async function recordNotice() {
    if (acknowledged.current) return true;
    setBusy(true);
    setError(null);
    try {
      const saved = await hub.updateHubPreferences({
        daily_briefing_prompted: true,
        device_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expected_user_id: accountId,
      });
      if (!active.current) return false;
      setNotificationPreferences(saved.preferences);
      acknowledged.current = true;
      return true;
    } catch {
      if (active.current) setError('Couldn’t save your briefing settings. Try again.');
      return false;
    } finally {
      if (active.current) setBusy(false);
    }
  }

  async function finish(manage = false) {
    if (busy || !active.current) return;
    // A session refresh can remount the shell while the notice is opening.
    // Acknowledge an actual user dismissal, so that cannot hide an unseen notice.
    await recordNotice();
    if (!active.current) return;
    setOpen(false);
    if (manage) router.push('/app/settings/notifications');
  }

  if (!preferences) return null;
  return (
    <ModalShell open={open} title="Your daily briefings" icon={BellRing}
      onClose={() => void finish()} onCancel={() => void finish()} cancelLabel="Got it"
      onSubmit={() => void finish(true)} submitLabel="Manage notifications" submitting={busy}>
      <div className="space-y-3 text-sm text-app-text">
        <p>Morning: {preferences.daily_briefing_enabled ? `On at ${preferences.daily_briefing_time_local}` : 'Off'}<br />
          Evening: {preferences.evening_briefing_enabled ? `On at ${preferences.evening_briefing_time_local}` : 'Off'}</p>
        <p>Times follow your briefing location’s time zone. We only notify you when there’s something useful.</p>
        <p>Change the times or turn either briefing off in Settings → Notifications. Your device also needs to allow Pantopus notifications.</p>
        {error && <p role="alert" className="text-app-error">{error}</p>}
      </div>
    </ModalShell>
  );
}
