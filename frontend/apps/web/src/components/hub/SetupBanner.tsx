'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Wrench, CreditCard, UserCheck, Check, Circle, Home, ShieldCheck } from 'lucide-react';
import type { SetupStep } from './types';

interface SetupBannerProps {
  steps: SetupStep[];
}

// Wedge order: claim → verify → profile. Keys come from the backend
// (`routes/hub.js` setupSteps); unknown keys fall back to a plain chip.
const stepConfig: Record<string, { label: string; route: string; icon: ReactNode }> = {
  home: { label: 'Claim your address', route: '/app/homes/new', icon: <Home className="w-4 h-4" /> },
  verify: { label: 'Verify your address', route: '/app/place', icon: <ShieldCheck className="w-4 h-4" /> },
  complete_profile: { label: 'Complete profile', route: '/app/profile/edit', icon: <UserCheck className="w-4 h-4" /> },
  profile_photo: { label: 'Add profile photo', route: '/app/profile/edit', icon: <Camera className="w-4 h-4" /> },
  skills: { label: 'Add skills', route: '/app/professional', icon: <Wrench className="w-4 h-4" /> },
  payout_method: { label: 'Add payout method', route: '/app/settings/payments', icon: <CreditCard className="w-4 h-4" /> },
};

export default function SetupBanner({ steps }: SetupBannerProps) {
  const router = useRouter();
  if (steps.every((s) => s.done)) return null;

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold text-app-text dark:text-white">
          {steps.some((s) => (s.key === 'home' || s.key === 'verify') && !s.done) ? 'Set up your place' : 'Complete your profile'}
        </p>
        <span className="text-xs text-app-text-muted dark:text-app-text-secondary">{completedCount}/{steps.length}</span>
      </div>

      <div className="w-full bg-app-surface-sunken rounded-full h-1 mb-3">
        <div className="bg-primary-600 h-1 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((step) => {
          const config = stepConfig[step.key] || { label: step.key, route: '/app/profile/edit', icon: <Circle className="w-4 h-4" /> };
          return (
            <button
              key={step.key}
              onClick={() => !step.done && router.push(config.route)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                step.done
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-app-surface-raised text-app-text-strong hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer'
              }`}
            >
              <span>{step.done ? <Check className="w-4 h-4" /> : config.icon}</span>
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
