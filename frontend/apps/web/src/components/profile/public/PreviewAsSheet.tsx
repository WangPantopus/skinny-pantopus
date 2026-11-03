'use client';

import { useId, type ReactNode } from 'react';
import { ChevronRight, Globe, UserCheck, Users } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { secondaryButton } from './profileButtons';

export type PreviewAudience = 'anyone' | 'neighbors' | 'connections';

export const PREVIEW_AUDIENCES: Array<{ key: PreviewAudience; label: string; detail: string; icon: ReactNode }> = [
  {
    key: 'anyone',
    label: 'Anyone with the link',
    detail: 'People who aren’t signed in, like someone you text your link to.',
    icon: <Globe className="w-5 h-5" />,
  },
  {
    key: 'neighbors',
    label: 'Neighbors',
    detail: 'People on Pantopus you aren’t connected to.',
    icon: <Users className="w-5 h-5" />,
  },
  {
    key: 'connections',
    label: 'Your connections',
    detail: 'They also see posts you shared only with connections.',
    icon: <UserCheck className="w-5 h-5" />,
  },
];

interface PreviewAsSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (audience: PreviewAudience) => void;
}

/** "Preview your profile as": anyone with the link, neighbors, or your connections; each answers from the server. */
export default function PreviewAsSheet({ open, onClose, onPick }: PreviewAsSheetProps) {
  const titleId = useId();
  return (
    <BottomSheet open={open} onClose={onClose} labelledBy={titleId}>
      <div className="px-1 pb-1">
        <h2 id={titleId} className="text-[1.375rem] leading-7 font-bold text-app">Preview your profile as</h2>
        <p className="mt-1 text-[0.9375rem] leading-5 text-app-muted">See it exactly the way each group does.</p>
        <ul className="mt-4 rounded-2xl border border-app bg-surface divide-y divide-app overflow-hidden">
          {PREVIEW_AUDIENCES.map((audience) => (
            <li key={audience.key}>
              <button
                type="button"
                onClick={() => onPick(audience.key)}
                className="w-full min-h-[4rem] px-4 py-3 flex items-center gap-3 text-left hover-bg-app"
              >
                <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-primary-50 text-app-link flex items-center justify-center">
                  {audience.icon}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-base leading-[1.3125rem] font-semibold text-app">{audience.label}</span>
                  <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{audience.detail}</span>
                </span>
                <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-app-muted" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className={`mt-4 w-full ${secondaryButton}`}>
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
