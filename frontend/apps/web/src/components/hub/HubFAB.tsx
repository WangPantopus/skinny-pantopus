'use client';

import { useRouter } from 'next/navigation';
import { Plus, MessageCircle, Users, Building2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface HubFABProps {
  open: boolean;
  onToggle: () => void;
  hasHome: boolean;
  hasBusiness: boolean;
  activeHomeId: string | null;
}

export default function HubFAB({ open, onToggle, hasHome, hasBusiness, activeHomeId }: HubFABProps) {
  const router = useRouter();
  const actions: { label: string; icon: ReactNode; route: string }[] = [
    { label: 'Post Task', icon: <Plus className="w-5 h-5" />, route: '/app/gigs-v2/new' },
    { label: 'New Message', icon: <MessageCircle className="w-5 h-5" />, route: '/app/chat' },
  ];
  if (hasHome && activeHomeId) {
    actions.push({ label: 'Invite Member', icon: <Users className="w-5 h-5" />, route: `/app/homes/${activeHomeId}/dashboard?tab=members` });
  }
  if (hasBusiness) {
    actions.push({ label: 'My Businesses', icon: <Building2 className="w-5 h-5" />, route: '/app/businesses' });
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-40" onClick={onToggle} />}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-8 z-50 flex flex-col gap-2 items-end">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => { onToggle(); router.push(action.route); }}
              className="flex items-center gap-3 px-4 py-2.5 bg-app-surface border border-app-border rounded-xl shadow-lg hover:shadow-xl text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-700 transition animate-[fadeInUp_0.2s_ease-out]"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              <span className="text-lg">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={onToggle}
        className={`fixed bottom-6 right-4 sm:right-8 z-50 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all duration-200 flex items-center justify-center ${open ? 'rotate-45' : ''}`}
        aria-label="Quick actions"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </>
  );
}
