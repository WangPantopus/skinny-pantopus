'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useLegacyMailDetail } from './useLegacyMailDetail';
import { resolveDeliverableType } from './legacy-detail-utils';
import MailDetailMetaBar, { MailDetailActionBar } from './MailDetailHeader';
import MailDetailContent from './MailDetailContent';
import MailDetailSidebar from './MailDetailSidebar';

export default function MailDetailPage() {
  const {
    mail,
    loading,
    error,
    actionError,
    actionSuccess,
    backHref,
    ackLoading,
    linkType,
    setLinkType,
    linkTargetId,
    setLinkTargetId,
    linkSaving,
    linkPreviews,
    linkPreviewLoading,
    scrollRef,
    handleDetailScroll,
    handleStar,
    handleArchiveToggle,
    handleDelete,
    handleAcknowledge,
    handleCreateLink,
    homeLabelFor,
  } = useLegacyMailDetail();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-app-border border-t-gray-700 mx-auto" />
          <p className="text-sm text-app-text-secondary mt-3">Loading mail...</p>
        </div>
      </div>
    );
  }

  if (error || !mail) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href={backHref} className="inline-flex items-center text-sm text-app-text-secondary hover:text-app-text">
          <ChevronLeft className="w-4 h-4 inline" /> Back to mailbox
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Mail not found.'}
        </div>
      </div>
    );
  }

  const deliverableType = resolveDeliverableType(mail);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <MailDetailActionBar
        mail={mail}
        backHref={backHref}
        onStar={handleStar}
        onArchiveToggle={handleArchiveToggle}
        onDelete={handleDelete}
      />

      {(actionError || actionSuccess) && (
        <div className={`mb-4 text-sm px-3 py-2 rounded-lg border ${
          actionError
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {actionError || actionSuccess}
        </div>
      )}

      <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
        <MailDetailMetaBar
          mail={mail}
          homeLabelFor={homeLabelFor}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div
            ref={scrollRef}
            onScroll={handleDetailScroll}
            className="p-5 border-b lg:border-b-0 lg:border-r border-app-border-subtle max-h-[calc(100vh-280px)] overflow-y-auto"
          >
            <MailDetailContent
              mail={mail}
              deliverableType={deliverableType}
              ackLoading={ackLoading}
              onAcknowledge={handleAcknowledge}
            />
          </div>

          <MailDetailSidebar
            mail={mail}
            linkPreviews={linkPreviews}
            linkPreviewLoading={linkPreviewLoading}
            linkType={linkType}
            onLinkTypeChange={setLinkType}
            linkTargetId={linkTargetId}
            onLinkTargetIdChange={setLinkTargetId}
            linkSaving={linkSaving}
            onCreateLink={handleCreateLink}
          />
        </div>
      </div>
    </div>
  );
}
