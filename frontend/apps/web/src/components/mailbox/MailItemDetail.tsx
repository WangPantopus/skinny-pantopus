'use client';

/* eslint-disable @next/next/no-img-element */
import type {
  MailItemDetailResponse,
  InsideBlock,
  MailAction,
  MailAttachment,
} from '@/types/mailbox';
// Security: DOMPurify is required to sanitize HTML rendered via dangerouslySetInnerHTML.
// Do not remove — mail content is untrusted user/external input (AUTH-3.2).
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import TrustBadge from './TrustBadge';
import UrgencyIndicator from './UrgencyIndicator';
import DrawerBadge from './DrawerBadge';
import AIElfStrip from './AIElfStrip';

type MailItemDetailProps = {
  detail: MailItemDetailResponse;
  onAction?: (action: MailAction) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── HTML sanitization config (AUTH-3.2) ──────────────────────

const SANITIZE_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    'p', 'div', 'span', 'a', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
    'strong', 'em', 'b', 'i', 'u', 'blockquote', 'pre', 'code', 'hr',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'class', 'style',
    'width', 'height', 'colspan', 'rowspan',
  ],
  ALLOW_DATA_ATTR: false,
};

// Strip javascript: URIs from href/src after sanitization
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute('href')) {
    const val = node.getAttribute('href') || '';
    if (/^\s*javascript\s*:/i.test(val)) {
      node.removeAttribute('href');
    }
  }
  if (node.hasAttribute('src')) {
    const val = node.getAttribute('src') || '';
    if (/^\s*javascript\s*:/i.test(val)) {
      node.removeAttribute('src');
    }
  }
});

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, SANITIZE_CONFIG) as unknown as string;
}

// ── Block renderers ──────────────────────────────────────────

function TextBlockView({ block }: { block: InsideBlock & { type: 'text' } }) {
  if (block.format === 'html') {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
      />
    );
  }
  return <p className="text-sm text-app-text-strong whitespace-pre-wrap">{block.content}</p>;
}

function ImageBlockView({ block }: { block: InsideBlock & { type: 'image' } }) {
  return (
    <figure className="my-3">
      <img
        src={block.url}
        alt={block.alt || ''}
        className="rounded-lg max-w-full h-auto"
        style={{ maxHeight: 400 }}
      />
    </figure>
  );
}

function TableBlockView({ block }: { block: InsideBlock & { type: 'table' } }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-app-border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-app-surface-raised">
            {block.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-app-text-secondary dark:text-app-text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-app-border-subtle">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-app-text-strong">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {block.caption && (
        <p className="px-3 py-1.5 text-xs text-app-text-secondary bg-app-surface-raised border-t border-app-border-subtle">
          {block.caption}
        </p>
      )}
    </div>
  );
}

function AmountDueBlockView({ block }: { block: InsideBlock & { type: 'amount_due' } }) {
  return (
    <div className="my-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Amount Due</p>
          {block.payee && <p className="text-sm text-app-text-strong mt-0.5">{block.payee}</p>}
          {block.account_number_masked && (
            <p className="text-xs text-app-text-secondary mt-0.5">Account: {block.account_number_masked}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
            {block.currency === 'USD' ? '$' : block.currency}
            {block.amount.toFixed(2)}
          </p>
          {block.due_date && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Due {new Date(block.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackingBlockView({ block }: { block: InsideBlock & { type: 'tracking' } }) {
  return (
    <div className="my-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">{block.carrier}</span>
      </div>
      <p className="text-xs text-app-text-secondary dark:text-app-text-muted">Tracking: {block.tracking_id_masked}</p>
      <p className="text-sm font-medium text-app-text mt-1">{block.status}</p>
      {(block.eta_earliest || block.eta_latest) && (
        <p className="text-xs text-app-text-secondary mt-0.5">
          ETA: {block.eta_earliest ? new Date(block.eta_earliest).toLocaleDateString() : ''}
          {block.eta_latest && block.eta_earliest ? ' – ' : ''}
          {block.eta_latest ? new Date(block.eta_latest).toLocaleDateString() : ''}
        </p>
      )}
    </div>
  );
}

function DocumentBlockView({ block }: { block: InsideBlock & { type: 'document' } }) {
  return (
    <a
      href={block.document_url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-3 flex items-center gap-3 p-3 rounded-lg border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
    >
      <svg className="w-8 h-8 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-app-text truncate">{block.document_type}</p>
        <p className="text-xs text-app-text-secondary">
          {block.page_count ? `${block.page_count} pages` : ''}
          {block.page_count && block.file_size_bytes ? ' · ' : ''}
          {block.file_size_bytes ? formatBytes(block.file_size_bytes) : ''}
        </p>
      </div>
      <svg className="w-4 h-4 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

function ActionPromptBlockView({ block, onAction }: { block: InsideBlock & { type: 'action_prompt' }; onAction?: (a: MailAction) => void }) {
  return (
    <div className="my-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
      <p className="text-sm text-app-text-strong">{block.prompt_text}</p>
      <button
        type="button"
        onClick={() => onAction?.(block.action)}
        className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
      >
        {block.action.label}
      </button>
    </div>
  );
}

function RichContentBlockView({ block }: { block: InsideBlock & { type: 'rich_content' } }) {
  return (
    <div
      className="my-3 prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
    />
  );
}

function renderBlock(block: InsideBlock, onAction?: (a: MailAction) => void) {
  switch (block.type) {
    case 'text': return <TextBlockView key={block.id} block={block} />;
    case 'image': return <ImageBlockView key={block.id} block={block} />;
    case 'table': return <TableBlockView key={block.id} block={block} />;
    case 'amount_due': return <AmountDueBlockView key={block.id} block={block} />;
    case 'tracking': return <TrackingBlockView key={block.id} block={block} />;
    case 'action_prompt': return <ActionPromptBlockView key={block.id} block={block} onAction={onAction} />;
    case 'document': return <DocumentBlockView key={block.id} block={block} />;
    case 'rich_content': return <RichContentBlockView key={block.id} block={block} />;
    default: return null;
  }
}

// ── Attachment list ──────────────────────────────────────────

function AttachmentList({ attachments }: { attachments: MailAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-app-border-subtle">
      <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-2">
        Attachments ({attachments.length})
      </p>
      <div className="space-y-1.5">
        {attachments.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 transition-colors text-sm"
          >
            <svg className="w-4 h-4 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="truncate flex-1 text-app-text-strong">{a.filename}</span>
            <span className="flex-shrink-0 text-xs text-app-text-muted">{formatBytes(a.size_bytes)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Action bar ───────────────────────────────────────────────

function ActionBar({ actions, onAction }: { actions: MailAction[]; onAction?: (a: MailAction) => void }) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-app-border-subtle flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onAction?.(action)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            action.destructive
              ? 'text-red-600 border border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30'
              : 'text-app-text-strong border border-app-border hover:bg-app-hover dark:hover:bg-gray-800'
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function MailItemDetail({ detail, onAction }: MailItemDetailProps) {
  const { wrapper, inside, policy } = detail;
  const blocks = [...inside.blocks].sort((a, b) => a.order - b.order);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-app-border-subtle">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-app-text">
              {wrapper.outside_title}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm text-app-text-secondary dark:text-app-text-muted">
                {wrapper.sender_display}
              </span>
              <TrustBadge trust={wrapper.sender_trust} size="sm" />
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              {formatDate(wrapper.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DrawerBadge drawer={wrapper.drawer} />
            <UrgencyIndicator urgency={wrapper.urgency} />
          </div>
        </div>

        {/* Routing preview */}
        {wrapper.routing_preview?.needs_resolution && (
          <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Routing suggestion: <strong>{wrapper.routing_preview.suggested_drawer}</strong>
              {wrapper.routing_preview.matched_user_name && (
                <> for {wrapper.routing_preview.matched_user_name}</>
              )}
            </p>
          </div>
        )}

        {/* Certified banner */}
        {policy.certified && (
          <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
              Certified Mail — Acknowledgment required
            </p>
          </div>
        )}
      </div>

      {/* AI Elf strip */}
      {(inside.key_facts.length > 0 || inside.ai_elf_summary) && (
        <div className="px-6 py-3 border-b border-app-border-subtle bg-app-surface-raised/50">
          <AIElfStrip keyFacts={inside.key_facts} summary={inside.ai_elf_summary} />
        </div>
      )}

      {/* Content blocks */}
      <div className="px-6 py-4">
        {blocks.map((block) => renderBlock(block, onAction))}

        {/* Attachments */}
        <AttachmentList attachments={inside.attachments} />

        {/* Actions */}
        <ActionBar actions={inside.actions} onAction={onAction} />
      </div>
    </div>
  );
}
