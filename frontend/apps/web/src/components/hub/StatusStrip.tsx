'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, Mail, CreditCard, CheckSquare, ClipboardList,
  Truck, FileText, Bell, MapPin, Check, Search, Zap, Handshake,
} from 'lucide-react';
import type { ActionItem } from './types';

interface StatusStripProps {
  items: ActionItem[];
  hasHome: boolean;
  activeHomeId: string | null;
  setupDone: boolean;
  setupTotal: number;
  setupCompleted: number;
}

const severityStyles: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  neutral: 'bg-app-surface-raised border-app-border text-app-text-secondary',
};

const typeIcons: Record<string, ReactNode> = {
  chat_unread: <MessageCircle className="w-4 h-4" />,
  mail_new: <Mail className="w-4 h-4" />,
  bill_due: <CreditCard className="w-4 h-4" />,
  task_due: <CheckSquare className="w-4 h-4" />,
  gig_update: <ClipboardList className="w-4 h-4" />,
  package_update: <Truck className="w-4 h-4" />,
  business_order: <FileText className="w-4 h-4" />,
  system_alert: <Bell className="w-4 h-4" />,
};

type Pill = { id: string; icon: ReactNode; label: string; route: string; severity: string };

export default function StatusStrip({
  items, hasHome, activeHomeId, setupDone, setupTotal, setupCompleted,
}: StatusStripProps) {
  const router = useRouter();

  const pills: Pill[] = items.map((item) => ({
    id: item.id,
    icon: typeIcons[item.type] || <MapPin className="w-4 h-4" />,
    label: item.title + (item.subtitle ? ` · ${item.subtitle}` : ''),
    route: item.route,
    severity: item.severity,
  }));

  // Pad with neutral pills up to 5
  const neutralPills: Pill[] = [];
  if (pills.length === 0) {
    neutralPills.push({ id: 'n-caughtup', icon: <Check className="w-4 h-4" />, label: 'All caught up', route: '', severity: 'neutral' });
  }
  neutralPills.push({ id: 'n-discover', icon: <Search className="w-4 h-4" />, label: 'Discover tasks near you', route: '/app/gigs', severity: 'neutral' });
  if (!setupDone) {
    neutralPills.push({ id: 'n-setup', icon: <Zap className="w-4 h-4" />, label: `Finish setup (${setupCompleted}/${setupTotal})`, route: '/app/profile/edit', severity: 'neutral' });
  }
  if (hasHome && activeHomeId) {
    neutralPills.push({ id: 'n-mailbox', icon: <Mail className="w-4 h-4" />, label: 'Check mailbox', route: `/app/mailbox?scope=home&homeId=${activeHomeId}`, severity: 'neutral' });
  }
  neutralPills.push({ id: 'n-invite', icon: <Handshake className="w-4 h-4" />, label: 'Invite a friend', route: '/app/connections', severity: 'neutral' });

  for (const np of neutralPills) {
    if (pills.length >= 5) break;
    if (!pills.some((p) => p.id === np.id)) pills.push(np);
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin -mx-4 px-4">
      {pills.map((pill) => (
        <button
          key={pill.id}
          onClick={() => pill.route && router.push(pill.route)}
          className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 border rounded-full text-[13px] font-medium transition hover:shadow-sm ${
            severityStyles[pill.severity] || severityStyles.neutral
          }`}
        >
          <span>{pill.icon}</span>
          <span className="whitespace-nowrap">{pill.label}</span>
        </button>
      ))}
    </div>
  );
}
