'use client';

import Link from 'next/link';
import { Link2 } from 'lucide-react';
import type { MailItem, MailLink, LinkedTargetPreview } from './legacy-detail-types';
import { TARGET_TYPE_META } from './legacy-detail-constants';
import { shortenId, getLinkPreviewKey, deliveryScopeLabel } from './legacy-detail-utils';

function EnvelopeSection({
  mail,
  scopeLabel,
  totalLinkedTargets,
}: {
  mail: MailItem;
  scopeLabel: string;
  totalLinkedTargets: number;
}) {
  return (
    <>
      <h3 className="text-xs uppercase tracking-wider text-app-text-secondary font-semibold">Envelope</h3>
      <div className="rounded-lg border border-app-border bg-app-surface p-3 text-sm text-app-text-strong space-y-1">
        <p><span className="font-medium">Scope:</span> {scopeLabel}</p>
        <p><span className="font-medium">Visibility:</span> {mail.delivery_visibility || 'default'}</p>
        <p><span className="font-medium">Viewed:</span> {mail.viewed ? 'Yes' : 'No'}</p>
        {typeof mail.view_count === 'number' && (
          <p><span className="font-medium">View count:</span> {mail.view_count}</p>
        )}
        {typeof mail.total_read_time_ms === 'number' && (
          <p><span className="font-medium">Read time:</span> {(mail.total_read_time_ms / 1000).toFixed(1)}s</p>
        )}
        {mail.payout_amount ? (
          <p><span className="font-medium">Payout:</span> +${mail.payout_amount.toFixed(2)}</p>
        ) : null}
        <p><span className="font-medium">Linked targets:</span> {totalLinkedTargets}</p>
      </div>
    </>
  );
}

function LinkPreviewCard({ link, preview }: { link: MailLink; preview?: LinkedTargetPreview }) {
  const meta = TARGET_TYPE_META[link.target_type] || { label: link.target_type, icon: <Link2 className="w-4 h-4 inline" /> };

  return (
    <div className="rounded-md border border-app-border-subtle bg-app-surface-raised px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-app-text">
          {meta.icon} {meta.label}
        </div>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
          link.created_by === 'system'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-app-surface-sunken text-app-text-strong'
        }`}>
          {link.created_by === 'system' ? 'Auto' : 'Manual'}
        </span>
      </div>
      <div className="text-[12px] font-medium text-app-text mt-1 break-words">
        {preview?.title || `${meta.label} target`}
      </div>
      {preview?.subtitle && (
        <div className="text-[11px] text-app-text-secondary mt-0.5 break-words">
          {preview.subtitle}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-app-text-muted">ID {shortenId(link.target_id)}</span>
        {preview?.href && (
          <Link
            href={preview.href}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
          >
            Open
          </Link>
        )}
      </div>
    </div>
  );
}

function AddLinkForm({
  linkType,
  onLinkTypeChange,
  linkTargetId,
  onLinkTargetIdChange,
  linkSaving,
  onCreateLink,
}: {
  linkType: MailLink['target_type'];
  onLinkTypeChange: (type: MailLink['target_type']) => void;
  linkTargetId: string;
  onLinkTargetIdChange: (value: string) => void;
  linkSaving: boolean;
  onCreateLink: () => void;
}) {
  return (
    <div className="pt-2 border-t border-app-border-subtle space-y-2">
      <p className="text-[11px] text-app-text-secondary">Add link manually</p>
      <select
        value={linkType}
        onChange={(e) => onLinkTypeChange(e.target.value as MailLink['target_type'])}
        className="w-full border border-app-border rounded-md px-2 py-1.5 text-xs bg-app-surface"
      >
        <option value="document">Document</option>
        <option value="bill">Bill</option>
        <option value="issue">Issue</option>
        <option value="package">Package</option>
      </select>
      <input
        type="text"
        value={linkTargetId}
        onChange={(e) => onLinkTargetIdChange(e.target.value)}
        placeholder="Target UUID"
        className="w-full border border-app-border rounded-md px-2 py-1.5 text-xs"
      />
      <button
        onClick={onCreateLink}
        disabled={linkSaving || !linkTargetId.trim()}
        className="w-full px-2 py-1.5 rounded-md text-xs font-medium border border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover disabled:opacity-50"
      >
        {linkSaving ? 'Adding...' : 'Add Link'}
      </button>
    </div>
  );
}

function FanoutLinksSection({
  mail,
  linkPreviews,
  linkPreviewLoading,
  linkType,
  onLinkTypeChange,
  linkTargetId,
  onLinkTargetIdChange,
  linkSaving,
  onCreateLink,
}: {
  mail: MailItem;
  linkPreviews: Record<string, LinkedTargetPreview>;
  linkPreviewLoading: boolean;
  linkType: MailLink['target_type'];
  onLinkTypeChange: (type: MailLink['target_type']) => void;
  linkTargetId: string;
  onLinkTargetIdChange: (value: string) => void;
  linkSaving: boolean;
  onCreateLink: () => void;
}) {
  const links = mail.links || [];

  return (
    <>
      <h3 className="text-xs uppercase tracking-wider text-app-text-secondary font-semibold pt-2">Fanout Links</h3>
      <div className="rounded-lg border border-app-border bg-app-surface p-3 space-y-2">
        {linkPreviewLoading && (
          <p className="text-[11px] text-app-text-secondary">Loading linked target previews…</p>
        )}
        {links.length === 0 ? (
          <p className="text-xs text-app-text-secondary">No linked targets yet.</p>
        ) : (
          <div className="space-y-1.5">
            {links.map((link) => (
              <LinkPreviewCard
                key={link.id}
                link={link}
                preview={linkPreviews[getLinkPreviewKey(link)]}
              />
            ))}
          </div>
        )}

        <AddLinkForm
          linkType={linkType}
          onLinkTypeChange={onLinkTypeChange}
          linkTargetId={linkTargetId}
          onLinkTargetIdChange={onLinkTargetIdChange}
          linkSaving={linkSaving}
          onCreateLink={onCreateLink}
        />
      </div>
    </>
  );
}

export default function MailDetailSidebar({
  mail,
  linkPreviews,
  linkPreviewLoading,
  linkType,
  onLinkTypeChange,
  linkTargetId,
  onLinkTargetIdChange,
  linkSaving,
  onCreateLink,
}: {
  mail: MailItem;
  linkPreviews: Record<string, LinkedTargetPreview>;
  linkPreviewLoading: boolean;
  linkType: MailLink['target_type'];
  onLinkTypeChange: (type: MailLink['target_type']) => void;
  linkTargetId: string;
  onLinkTargetIdChange: (value: string) => void;
  linkSaving: boolean;
  onCreateLink: () => void;
}) {
  const scopeLabel = deliveryScopeLabel(mail);
  const totalLinkedTargets = (mail.links || []).length;

  return (
    <aside className="p-5 space-y-3 bg-app-surface-raised/50">
      <EnvelopeSection
        mail={mail}
        scopeLabel={scopeLabel}
        totalLinkedTargets={totalLinkedTargets}
      />
      <FanoutLinksSection
        mail={mail}
        linkPreviews={linkPreviews}
        linkPreviewLoading={linkPreviewLoading}
        linkType={linkType}
        onLinkTypeChange={onLinkTypeChange}
        linkTargetId={linkTargetId}
        onLinkTargetIdChange={onLinkTargetIdChange}
        linkSaving={linkSaving}
        onCreateLink={onCreateLink}
      />
    </aside>
  );
}
