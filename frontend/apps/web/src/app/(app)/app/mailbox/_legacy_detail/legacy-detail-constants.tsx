import type { ReactNode } from 'react';
import {
  Mail, CreditCard, BarChart3, ClipboardList, Package,
  Newspaper, Megaphone, Gift, FileText, Mailbox, Receipt, Wrench
} from 'lucide-react';
import type { DeliverableType, DeliverableMeta, MailLink, TargetTypeMeta } from './legacy-detail-types';

export const MAIL_TYPE_ICON: Record<string, ReactNode> = {
  letter: <Mail className="w-5 h-5" />,
  bill: <CreditCard className="w-5 h-5" />,
  statement: <BarChart3 className="w-5 h-5" />,
  notice: <ClipboardList className="w-5 h-5" />,
  package: <Package className="w-5 h-5" />,
  newsletter: <Newspaper className="w-5 h-5" />,
  promotion: <Gift className="w-5 h-5" />,
  ad: <Megaphone className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  other: <Mailbox className="w-5 h-5" />
};

export const DELIVERABLE_META: Record<DeliverableType, DeliverableMeta> = {
  letter: { label: 'Letter', badge: 'bg-blue-100 text-blue-700' },
  packet: { label: 'Packet', badge: 'bg-green-100 text-green-700' },
  bill: { label: 'Bill', badge: 'bg-red-100 text-red-700' },
  book: { label: 'Book', badge: 'bg-indigo-100 text-indigo-700' },
  notice: { label: 'Notice', badge: 'bg-amber-100 text-amber-700' },
  promotion: { label: 'Promotion', badge: 'bg-pink-100 text-pink-700' },
  other: { label: 'Mail', badge: 'bg-app-surface-sunken text-app-text-strong' }
};

export const TARGET_TYPE_META: Record<MailLink['target_type'], TargetTypeMeta> = {
  bill: { label: 'Bill', icon: <Receipt className="w-4 h-4 inline" /> },
  issue: { label: 'Issue', icon: <Wrench className="w-4 h-4 inline" /> },
  package: { label: 'Package', icon: <Package className="w-4 h-4 inline" /> },
  document: { label: 'Document', icon: <FileText className="w-4 h-4 inline" /> }
};

export const TARGET_TYPE_HOME_TAB: Record<MailLink['target_type'], string> = {
  bill: 'bills',
  issue: 'issues',
  package: 'packages',
  document: 'documents'
};
