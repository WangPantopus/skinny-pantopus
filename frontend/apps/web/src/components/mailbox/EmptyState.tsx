'use client';

import type { ReactNode } from 'react';
import { MailOpen, Home, Briefcase, Wallet, CheckCircle, Archive, FolderOpen, Megaphone, Clock, MapPin } from 'lucide-react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
};

const SECTION_CONFIG: Record<string, EmptyStateProps> = {
  personal: {
    icon: <MailOpen className="w-10 h-10" />,
    title: 'Your personal mailbox is empty',
    description: 'Mail addressed to you will appear here.',
  },
  home: {
    icon: <Home className="w-10 h-10" />,
    title: 'No mail for your home yet',
    description: 'Home-related mail like utilities and HOA notices will appear here.',
  },
  business: {
    icon: <Briefcase className="w-10 h-10" />,
    title: 'No business mail yet',
    description: 'Business mail and invoices will appear here.',
  },
  earn: {
    icon: <Wallet className="w-10 h-10" />,
    title: 'No offers yet',
    description: 'Verified businesses in your area will appear here when available.',
  },
  counter: {
    icon: <CheckCircle className="w-10 h-10" />,
    title: 'All caught up',
    description: 'Nothing needs your attention right now.',
  },
  vault: {
    icon: <Archive className="w-10 h-10" />,
    title: 'Your vault is empty',
    description: 'File important mail here to keep it organized.',
  },
  vault_folder: {
    icon: <FolderOpen className="w-10 h-10" />,
    title: 'This folder is empty',
    description: 'Mail matching the auto-filing rules will appear here.',
  },
  tasks: {
    icon: <CheckCircle className="w-10 h-10" />,
    title: 'No tasks yet',
    description: 'Create tasks from any mail item.',
  },
  community: {
    icon: <Megaphone className="w-10 h-10" />,
    title: 'No neighborhood notices yet',
    description:
      'Verified government and business mail for your area will appear here.',
  },
  records: {
    icon: <Home className="w-10 h-10" />,
    title: 'No home assets yet',
    description:
      'Assets are detected automatically when you receive receipts and warranty mail.',
  },
  memory: {
    icon: <Clock className="w-10 h-10" />,
    title: 'No memories yet',
    description: "Check back after you've had your mailbox for a year.",
  },
  map: {
    icon: <MapPin className="w-10 h-10" />,
    title: 'No map pins yet',
    description:
      'Mail from verified government and utility senders will pin automatically.',
  },
};

export default function EmptyState({
  section,
  icon,
  title,
  description,
}: {
  section?: string;
  icon?: ReactNode;
  title?: string;
  description?: string;
}) {
  const config = section ? SECTION_CONFIG[section] : undefined;
  const finalIcon = icon ?? config?.icon ?? <MailOpen className="w-10 h-10" />;
  const finalTitle = title ?? config?.title ?? 'Nothing here yet';
  const finalDesc = description ?? config?.description;

  return (
    <div className="flex items-center justify-center py-12 px-6" role="status">
      <div className="text-center max-w-xs">
        <div className="flex justify-center mb-3 text-app-text-muted">{finalIcon}</div>
        <p className="text-sm font-medium text-app-text-secondary dark:text-app-text-muted">
          {finalTitle}
        </p>
        {finalDesc && (
          <p className="text-xs text-app-text-muted mt-1.5">{finalDesc}</p>
        )}
      </div>
    </div>
  );
}
