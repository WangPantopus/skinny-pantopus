'use client';

import { useRouter } from 'next/navigation';
import { User, Camera, FileText, Wrench, Check } from 'lucide-react';
import type { ProfileCompleteness } from './types';

interface ProfileCompletionCardProps {
  completeness: ProfileCompleteness;
}

const FIELD_META: Record<string, { label: string; icon: typeof User; route: string }> = {
  firstName: { label: 'Add your first name', icon: User, route: '/app/profile/edit' },
  lastName: { label: 'Add your last name', icon: User, route: '/app/profile/edit' },
  photo: { label: 'Upload a profile photo', icon: Camera, route: '/app/profile/edit' },
  bio: { label: 'Write a short bio', icon: FileText, route: '/app/profile/edit' },
  skills: { label: 'Add your professional skills', icon: Wrench, route: '/app/professional' },
};

export default function ProfileCompletionCard({ completeness }: ProfileCompletionCardProps) {
  const router = useRouter();
  const { score, checks, missingFields } = completeness;

  if (score >= 100) return null;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const ringColor =
    score >= 80 ? 'text-emerald-500' :
    score >= 50 ? 'text-amber-500' :
    'text-red-400';

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        {/* Progress ring */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32" cy="32" r={radius}
              fill="none" strokeWidth="4"
              className="stroke-gray-200 dark:stroke-gray-700"
            />
            <circle
              cx="32" cy="32" r={radius}
              fill="none" strokeWidth="4" strokeLinecap="round"
              className={ringColor}
              style={{
                stroke: 'currentColor',
                strokeDasharray: circumference,
                strokeDashoffset,
                transition: 'stroke-dashoffset 0.6s ease',
              }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-app-text dark:text-white">
            {score}%
          </span>
        </div>

        <div>
          <h3 className="font-semibold text-app-text dark:text-white">Complete your profile</h3>
          <p className="text-sm text-app-text-secondary dark:text-app-text-muted mt-0.5">
            {missingFields.length === 1
              ? 'Just 1 step left!'
              : `${missingFields.length} steps to a complete profile`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(checks).map(([field, done]) => {
          const meta = FIELD_META[field];
          if (!meta) return null;
          const Icon = meta.icon;

          return (
            <button
              key={field}
              onClick={() => !done && router.push(meta.route)}
              disabled={done}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                done
                  ? 'bg-emerald-50 dark:bg-emerald-900/10 cursor-default'
                  : 'bg-app-surface-sunken hover:bg-app-hover dark:hover:bg-gray-700 cursor-pointer'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                done
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
              }`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm font-medium ${
                done
                  ? 'text-emerald-700 dark:text-emerald-400 line-through'
                  : 'text-app-text-strong dark:text-white'
              }`}>
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
