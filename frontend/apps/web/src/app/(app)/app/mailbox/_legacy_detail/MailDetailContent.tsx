'use client';

import { Paperclip } from 'lucide-react';
import { renderSanitizedHtml, renderMarkdownSafe } from '../_components/MailContentRenderer';
import type { MailItem, DeliverableType } from './legacy-detail-types';
import { asNumber, asString, humanFileName } from './legacy-detail-utils';

function BodyContent({ item }: { item: MailItem }) {
  const format = item.content_format;
  if (format === 'html' || (!format && item.content.includes('<'))) {
    return <div className="prose prose-sm max-w-none">{renderSanitizedHtml(item.content)}</div>;
  }
  if (format === 'markdown') {
    return <div className="prose prose-sm max-w-none">{renderMarkdownSafe(item.content)}</div>;
  }
  return <div className="whitespace-pre-wrap text-app-text-strong leading-7">{item.content}</div>;
}

function Attachments({ attachments }: { attachments?: string[] }) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-2">
      {attachments.map((attachment, index) => (
        <a
          key={`${attachment}-${index}`}
          href={attachment}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-lg border border-app-border bg-app-surface-raised px-3 py-2 text-sm text-app-text-strong hover:bg-app-hover transition"
        >
          <span className="truncate"><Paperclip className="w-4 h-4 inline" /> {humanFileName(attachment, index)}</span>
          <span className="text-xs text-app-text-secondary ml-3">Open</span>
        </a>
      ))}
    </div>
  );
}

function LetterDetail({ item }: { item: MailItem }) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <div className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-3">Letter</div>
      <BodyContent item={item} />
    </section>
  );
}

function PacketDetail({ item }: { item: MailItem }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-5">
      <div className="text-xs uppercase tracking-wider text-app-text-secondary font-semibold mb-3">Packet Contents</div>
      <BodyContent item={item} />
      <Attachments attachments={item.attachments} />
    </section>
  );
}

function BillDetail({ item }: { item: MailItem }) {
  const extracted = (item.mail_extracted || {}) as Record<string, any>;
  const amount = asNumber(extracted.amount_due ?? extracted.amount ?? extracted.total ?? extracted.balance_due);
  const dueDate = asString(extracted.due_date ?? extracted.dueDate);
  const payee = asString(extracted.payee ?? extracted.biller ?? extracted.vendor);

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/30 p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-100 bg-app-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-app-text-secondary">Amount</div>
          <div className="text-lg font-semibold text-app-text">
            {amount !== null ? `$${amount.toFixed(2)}` : '\u2014'}
          </div>
        </div>
        <div className="rounded-lg border border-red-100 bg-app-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-app-text-secondary">Due Date</div>
          <div className="text-lg font-semibold text-app-text">
            {dueDate ? new Date(dueDate).toLocaleDateString() : '\u2014'}
          </div>
        </div>
        <div className="rounded-lg border border-red-100 bg-app-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-app-text-secondary">Payee</div>
          <div className="text-lg font-semibold text-app-text truncate">{payee || '\u2014'}</div>
        </div>
      </div>
      <BodyContent item={item} />
      <Attachments attachments={item.attachments} />
    </section>
  );
}

function BookDetail({ item }: { item: MailItem }) {
  const words = item.content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-indigo-700">Reading Mode</span>
        <span className="text-indigo-600">{minutes} min read</span>
      </div>
      <article className="rounded-lg border border-indigo-100 bg-app-surface p-5">
        <BodyContent item={item} />
      </article>
      <Attachments attachments={item.attachments} />
    </section>
  );
}

function NoticeDetail({
  item,
  ackLoading,
  onAcknowledge,
}: {
  item: MailItem;
  ackLoading: boolean;
  onAcknowledge: () => void;
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
      {item.ack_required && (
        <div className="rounded-lg border border-amber-200 bg-app-surface p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-app-text">Acknowledgement required</p>
            <p className="text-xs text-app-text-secondary">
              Status: {item.ack_status === 'acknowledged' ? 'Acknowledged' : 'Pending'}
            </p>
          </div>
          <button
            onClick={onAcknowledge}
            disabled={ackLoading || item.ack_status === 'acknowledged'}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
          >
            {item.ack_status === 'acknowledged'
              ? 'Acknowledged'
              : ackLoading
                ? 'Saving...'
                : 'Acknowledge'}
          </button>
        </div>
      )}
      <BodyContent item={item} />
      <Attachments attachments={item.attachments} />
    </section>
  );
}

function DefaultDetail({ item }: { item: MailItem }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-5">
      <BodyContent item={item} />
      <Attachments attachments={item.attachments} />
    </section>
  );
}

export default function MailDetailContent({
  mail,
  deliverableType,
  ackLoading,
  onAcknowledge,
}: {
  mail: MailItem;
  deliverableType: DeliverableType;
  ackLoading: boolean;
  onAcknowledge: () => void;
}) {
  if (deliverableType === 'letter') return <LetterDetail item={mail} />;
  if (deliverableType === 'packet') return <PacketDetail item={mail} />;
  if (deliverableType === 'bill') return <BillDetail item={mail} />;
  if (deliverableType === 'book') return <BookDetail item={mail} />;
  if (deliverableType === 'notice') {
    return <NoticeDetail item={mail} ackLoading={ackLoading} onAcknowledge={onAcknowledge} />;
  }
  return <DefaultDetail item={mail} />;
}
