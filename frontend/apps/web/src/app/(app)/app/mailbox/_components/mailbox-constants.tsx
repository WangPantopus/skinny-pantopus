import { Mail, CreditCard, BarChart3, ClipboardList, Package, Newspaper, Megaphone, Gift, FileText, Mailbox } from 'lucide-react';
import type { MailType, MailTypeConfig, QuickComposeForm, StructuredComposeForm } from './mailbox-types';

export const MAIL_TYPES: Record<string, MailTypeConfig> = {
  letter:     { icon: <Mail className="w-5 h-5" />,          label: 'Letter',     color: 'bg-blue-100 text-blue-700' },
  bill:       { icon: <CreditCard className="w-5 h-5" />,    label: 'Bill',        color: 'bg-red-100 text-red-700' },
  statement:  { icon: <BarChart3 className="w-5 h-5" />,     label: 'Statement',   color: 'bg-purple-100 text-purple-700' },
  notice:     { icon: <ClipboardList className="w-5 h-5" />, label: 'Notice',      color: 'bg-amber-100 text-amber-700' },
  package:    { icon: <Package className="w-5 h-5" />,       label: 'Package',     color: 'bg-green-100 text-green-700' },
  newsletter: { icon: <Newspaper className="w-5 h-5" />,     label: 'Newsletter',  color: 'bg-indigo-100 text-indigo-700' },
  ad:         { icon: <Megaphone className="w-5 h-5" />,     label: 'Ad',          color: 'bg-orange-100 text-orange-700' },
  promotion:  { icon: <Gift className="w-5 h-5" />,          label: 'Promotion',   color: 'bg-pink-100 text-pink-700' },
  document:   { icon: <FileText className="w-5 h-5" />,      label: 'Document',    color: 'bg-app-surface-sunken text-app-text-strong' },
  other:      { icon: <Mailbox className="w-5 h-5" />,       label: 'Mail',        color: 'bg-app-surface-sunken text-app-text-secondary' },
};

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500',
  high:   'border-l-orange-400',
  normal: '',
  low:    '',
};

export const DELIVERABLE_TYPE_META: Record<string, { label: string; color: string }> = {
  letter: { label: 'Letter', color: 'bg-blue-100 text-blue-700' },
  bill: { label: 'Bill', color: 'bg-red-100 text-red-700' },
  packet: { label: 'Packet', color: 'bg-green-100 text-green-700' },
  book: { label: 'Book', color: 'bg-indigo-100 text-indigo-700' },
  notice: { label: 'Notice', color: 'bg-amber-100 text-amber-700' },
  promotion: { label: 'Ad', color: 'bg-pink-100 text-pink-700' },
  other: { label: 'Mail', color: 'bg-app-surface-sunken text-app-text-strong' }
};

export const QUICK_COMPOSE_DEFAULTS: QuickComposeForm = {
  destinationType: 'home',
  destinationHomeId: '',
  recipientUserId: '',
  recipientQuery: '',
  visibility: 'home_members',
  attnLabel: 'Current Resident',
  type: 'letter',
  subject: '',
  content: ''
};

export const QUICK_COMPOSE_TYPE_OPTIONS: MailType[] = [
  'letter',
  'bill',
  'statement',
  'notice',
  'package',
  'document',
  'newsletter',
  'promotion'
];

export const COMPOSE_FIELD_CLASS =
  'w-full border border-app-border rounded-lg px-3 py-2 text-sm bg-app-surface text-app-text placeholder:text-app-text-secondary caret-gray-900 [color-scheme:light] disabled:bg-app-surface-sunken disabled:text-app-text-secondary';
export const COMPOSE_SELECT_CLASS =
  'w-full border border-app-border rounded-lg px-3 py-2 text-sm bg-app-surface text-app-text [color-scheme:light] disabled:bg-app-surface-sunken disabled:text-app-text-secondary';
export const COMPOSE_TEXTAREA_CLASS =
  'w-full border border-app-border rounded-lg px-3 py-2 text-sm min-h-32 bg-app-surface text-app-text placeholder:text-app-text-secondary caret-gray-900 [color-scheme:light] disabled:bg-app-surface-sunken disabled:text-app-text-secondary';

export const STRUCTURED_COMPOSE_DEFAULTS: StructuredComposeForm = {
  recipientMode: 'self',
  recipientUserId: '',
  recipientQuery: '',
  recipientHomeId: '',
  type: 'letter',
  subject: '',
  content: '',
  objectFormat: 'plain_text',
  category: '',
  priority: 'normal',
  tags: '',
  senderBusinessName: '',
  senderAddress: '',
  payoutAmount: ''
};
