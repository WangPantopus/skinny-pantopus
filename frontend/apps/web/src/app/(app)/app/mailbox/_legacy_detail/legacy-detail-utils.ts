import type { MailItem, MailLink, DeliverableType } from './legacy-detail-types';

export const resolveDeliverableType = (item: MailItem): DeliverableType => {
  if (item.mail_type) return item.mail_type;
  if (item.type === 'statement') return 'bill';
  if (item.type === 'package' || item.type === 'document') return 'packet';
  if (item.type === 'newsletter') return 'book';
  if (item.type === 'ad') return 'promotion';
  if (
    item.type === 'letter' ||
    item.type === 'bill' ||
    item.type === 'notice' ||
    item.type === 'promotion' ||
    item.type === 'other'
  ) {
    return item.type;
  }
  return 'other';
};

export const getSenderName = (item: MailItem) => {
  if (item.sender_business_name) return item.sender_business_name;
  if (item.sender?.name) return item.sender.name;
  if (item.sender?.username) return `@${item.sender.username}`;
  if (item.sender_address) return item.sender_address;
  return 'Pantopus';
};

export const getDisplayTitle = (item: MailItem) => {
  if (item.display_title && item.display_title.trim()) return item.display_title.trim();
  if (item.subject && item.subject.trim()) return item.subject.trim();
  return '(untitled)';
};

export const asString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
};

export const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const humanFileName = (value: string, index: number) => {
  try {
    const parsed = new URL(value);
    const base = parsed.pathname.split('/').pop();
    return decodeURIComponent(base || `Attachment ${index + 1}`);
  } catch {
    const base = value.split('/').pop();
    return decodeURIComponent(base || `Attachment ${index + 1}`);
  }
};

export const formatMoney = (value: unknown, currency: unknown = 'USD') => {
  const amount = asNumber(value);
  if (amount === null) return null;
  const currencyCode = asString(currency) || 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

export const formatDateLabel = (value: unknown) => {
  const dateText = asString(value);
  if (!dateText) return null;
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const shortenId = (value: string) => {
  if (!value) return '';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
};

export const getLinkPreviewKey = (link: Pick<MailLink, 'target_type' | 'target_id'>) => {
  return `${link.target_type}:${link.target_id}`;
};

export const deliveryScopeLabel = (item: MailItem) => {
  const targetType = item.delivery_target_type || item.recipient_type;
  return targetType === 'home' ? 'Home' : 'Personal';
};
