'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Home, CreditCard, CheckSquare, Mail } from 'lucide-react';
import type { HubHomeCard as HomeData } from './types';
import { launchFeatures } from '@/lib/featureFlags';

interface HomeCardProps {
  data: HomeData;
  homeId: string | null;
}

export default function HomeCard({ data, homeId }: HomeCardProps) {
  const router = useRouter();
  if (!homeId) return null;

  // Launch cut #7 (Household extras): bill management is hidden, so bills due are too.
  const billsDue = launchFeatures.householdExtras ? data.billsDue : [];
  const hasSomething = billsDue.length > 0 || data.tasksDue.length > 0 || data.newMail > 0;

  return (
    <div className="bg-app-surface border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><Home className="w-5 h-5" /></div>
          <h3 className="font-semibold text-app-text dark:text-white">Home</h3>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">Household</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {hasSomething ? (
          <>
            {billsDue.map((bill) => (
              <div key={bill.id} className="flex items-center gap-2 text-sm text-app-text-secondary">
                <CreditCard className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{bill.name}</span>
                <span className="font-medium text-app-text dark:text-white">${bill.amount.toFixed(2)}</span>
              </div>
            ))}
            {data.tasksDue.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm text-app-text-secondary">
                <CheckSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{task.title}</span>
              </div>
            ))}
            {data.newMail > 0 && (
              <div className="flex items-center gap-2 text-sm text-app-text-secondary">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>{data.newMail} new mail</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-app-text-secondary dark:text-app-text-muted">All clear — nothing due</span>
            <button
              onClick={() => router.push(`/app/homes/${homeId}/dashboard`)}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View dashboard →
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/app/homes/${homeId}/dashboard`)}
          className="flex-1 py-2.5 px-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
        >
          Open Home
        </button>
        <button
          onClick={() => router.push(`/app/mailbox?scope=home&homeId=${homeId}`)}
          className="py-2.5 px-3 bg-app-surface-sunken text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover dark:hover:bg-gray-600 transition"
        >
          Mailbox
        </button>
      </div>
    </div>
  );
}

/** "Later" snoozes the Attach a Home prompt for this account for a week, across loads and tabs. */
const ATTACH_HOME_LATER_KEY = 'pantopus.hub.attachHomeLaterUntil';
const ATTACH_HOME_LATER_MS = 7 * 24 * 60 * 60 * 1000;

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function isSnoozed(key: string): boolean {
  try {
    return Number(window.localStorage.getItem(key)) > Date.now();
  } catch {
    return false;
  }
}

export function AttachHomeCTA({ userId }: { userId: string }) {
  const router = useRouter();
  const key = `${ATTACH_HOME_LATER_KEY}:${userId}`;
  // Hidden on the server and until storage is read, so a snoozed card never flashes in.
  const snoozed = useSyncExternalStore(subscribeStorage, () => isSnoozed(key), () => true);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || snoozed) return null;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 border border-emerald-200 dark:border-emerald-800 border-dashed rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><Home className="w-5 h-5" /></div>
        <h3 className="font-semibold text-app-text dark:text-white">Attach a Home</h3>
      </div>
      <p className="text-sm text-app-text-secondary mb-4">
        {launchFeatures.householdExtras ? 'Unlock mailbox, bills, household tasks, and more.' : 'Unlock mailbox, household tasks, and more.'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => router.push('/app/homes/new')}
          className="py-2 px-4 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
        >
          Attach Home
        </button>
        <button
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(key, String(Date.now() + ATTACH_HOME_LATER_MS));
            } catch {
              // Storage unavailable (e.g. blocked): hidden for this visit only.
            }
          }}
          className="py-2 px-4 text-app-text-secondary dark:text-app-text-muted text-sm font-medium hover:text-app-text-strong dark:hover:text-gray-200 transition"
        >
          Later
        </button>
      </div>
    </div>
  );
}
