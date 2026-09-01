'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { MailAction, CertifiedMail, VaultFolder, BookletItem, AuditEvent, MailItemV2, PartyParticipant } from '@/types/mailbox';
import * as api from '@pantopus/api';
import {
  useItemDetail,
  useMarkItemOpened,
  useFileItemToVault,
  useAcknowledgeCertifiedMail,
  useDetectLanguage,
  useTranslateItem,
  useVaultFolders,
} from '@/lib/mailbox-queries';
import {
  MailItemDetail,
  TranslationBanner,
} from '@/components/mailbox';
import BookletViewer from '@/components/mailbox/BookletViewer';
import PackageUnboxing from '@/components/mailbox/PackageUnboxing';
import GigCreationModal from '@/components/mailbox/GigCreationModal';
import FamilyMailParty from '@/components/mailbox/FamilyMailParty';
import CertifiedMailDetail from '@/components/mailbox/CertifiedMailDetail';

/**
 * Mail item detail page — right pane on desktop, full page on mobile.
 *
 * Fetches the full MailItemDetailResponse on mount, marks it opened
 * if unread, and renders blocks, actions, certified banner,
 * translation banner, file-to-vault, package unboxing, family mail party,
 * and certified mail audit trail.
 */
export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams<{ drawer: string; item_id: string }>();
  const drawer = params.drawer;
  const itemId = params.item_id;

  // ── Data fetching ─────────────────────────────────────────
  const { data: detail, isLoading, error, refetch } = useItemDetail(itemId);
  const markOpened = useMarkItemOpened();

  // Mark as opened on first load
  const markedRef = useRef(false);
  useEffect(() => {
    if (detail && !detail.wrapper.opened_at && !markedRef.current) {
      markedRef.current = true;
      markOpened.mutate(itemId);
    }
  }, [detail, itemId, markOpened]);

  // ── Current user ──────────────────────────────────────────
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  useEffect(() => {
    let cancelled = false;
    api.users.getMyProfile().then(u => {
      if (cancelled) return;
      setCurrentUserId(u.id);
      setCurrentUserName(u.name || u.username || 'You');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Certified mail ────────────────────────────────────────
  const acknowledge = useAcknowledgeCertifiedMail();
  const isCertified = detail?.policy.certified ?? false;

  const handleAcknowledge = useCallback(() => {
    acknowledge.mutate(itemId);
  }, [acknowledge, itemId]);

  // Build CertifiedMail shape from wrapper + acknowledge result
  const certifiedItem: CertifiedMail | null = isCertified && detail ? {
    ...({} as CertifiedMail),
    id: detail.wrapper.id,
    certified: true as const,
    requires_acknowledgment: detail.policy.requires_acknowledgment,
    acknowledged_at: acknowledge.data?.acknowledged_at ?? (detail.wrapper as unknown as Record<string, any>).acknowledged_at as string | undefined,
    acknowledged_by: undefined,
    audit_trail: acknowledge.data?.audit_trail ?? [],
  } : null;

  const auditTrail: AuditEvent[] = acknowledge.data?.audit_trail ?? certifiedItem?.audit_trail ?? [];

  // ── Translation ───────────────────────────────────────────
  const { data: langDetect } = useDetectLanguage(itemId);
  const translate = useTranslateItem();
  const [showTranslation, setShowTranslation] = useState(false);
  // Cache translated content in local state so toggling never re-fetches
  const [cachedTranslation, setCachedTranslation] = useState<{
    content: string;
    fromLanguage: string;
  } | null>(null);

  const handleTranslate = useCallback(() => {
    // If we already have a cached translation, just toggle display
    if (cachedTranslation) {
      setShowTranslation(true);
      return;
    }
    translate.mutate({ itemId }, {
      onSuccess: (data) => {
        setCachedTranslation({
          content: data.translated_content,
          fromLanguage: data.from_language,
        });
        setShowTranslation(true);
      },
    });
  }, [translate, itemId, cachedTranslation]);

  const handleShowOriginal = useCallback(() => {
    setShowTranslation(false);
  }, []);

  const isNonEnglish =
    langDetect?.detected_language &&
    langDetect.confidence !== undefined &&
    langDetect.confidence > 0.85 &&
    langDetect.detected_language.toLowerCase() !== 'english' &&
    langDetect.detected_language.toLowerCase() !== 'en';

  const isPostcard = detail?.wrapper.mail_object_type === 'postcard';

  // ── File to Vault ─────────────────────────────────────────
  const { data: vaultFolders } = useVaultFolders();
  const fileToVault = useFileItemToVault();
  const [vaultOpen, setVaultOpen] = useState(false);
  const vaultRef = useRef<HTMLDivElement>(null);

  // Close vault dropdown on outside click
  useEffect(() => {
    if (!vaultOpen) return;
    const handler = (e: MouseEvent) => {
      if (vaultRef.current && !vaultRef.current.contains(e.target as Node)) {
        setVaultOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [vaultOpen]);

  const handleFileToVault = useCallback((folderId: string) => {
    fileToVault.mutate({ itemId, folderId }, {
      onSuccess: () => setVaultOpen(false),
    });
  }, [fileToVault, itemId]);

  // ── Package / Unboxing ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapperAny = detail?.wrapper as any;
  const isPackage = detail?.wrapper.mail_object_type === 'package';
  const isDelivered = isPackage && (wrapperAny?.status === 'delivered' || wrapperAny?.package_status === 'delivered');
  const [showGigModal, setShowGigModal] = useState(false);
  const [gigSource, setGigSource] = useState<'post_delivery' | 'pre_delivery'>('post_delivery');

  const handleConditionPhotoUpload = useCallback(async (file: File) => {
    await api.uploadFile(`/api/mailbox/v2/p2/package/${itemId}/condition-photo`, file);
  }, [itemId]);

  const handleCreatePackageGig = useCallback(async (data: {
    gigType: string;
    title: string;
    description: string;
    compensation?: number;
    suggestedStart?: string;
  }) => {
    const res = await api.mailboxV2P2.createPackageGig(itemId, {
      gigType: data.gigType as 'hold' | 'inside' | 'sign' | 'custom' | 'assembly',
      title: data.title,
      description: data.description,
      compensation: data.compensation,
      suggestedStart: data.suggestedStart,
    });
    return { gigId: res.gigId };
  }, [itemId]);

  // ── Family Mail Party ─────────────────────────────────────
  const isSharedHome = drawer === 'home';
  const [, setPartyRevealed] = useState(false);

  const checkPresence = useCallback(async (mailId: string) => {
    try {
      const res = await api.mailboxV2P2.getActiveParties();
      const session = res.sessions.find(s => s.mail_id === mailId);
      if (!session) return [];
      // Return participant list from session
      return ((session as unknown as Record<string, any>).participants ?? []) as PartyParticipant[];
    } catch {
      return [];
    }
  }, []);

  const handleCreateParty = useCallback(async (mailId: string) => {
    const res = await api.mailboxV2P2.createParty(mailId);
    return { sessionId: res.session.id };
  }, []);

  const handleSendReaction = useCallback(async (sessionId: string, emoji: string) => {
    await api.mailboxV2P2.sendReaction(sessionId, emoji);
  }, []);

  const handleAssignMember = useCallback(async (sessionId: string, userId: string) => {
    await api.mailboxV2P2.assignPartyItem({
      sessionId,
      mailId: itemId,
      assignToUserId: userId,
    });
  }, [itemId]);

  // ── Action handler ────────────────────────────────────────
  const handleAction = useCallback((action: MailAction) => {
    switch (action.action_type) {
      case 'file_to_vault':
        setVaultOpen(true);
        break;
      case 'acknowledge':
        handleAcknowledge();
        break;
      case 'translate':
        handleTranslate();
        break;
      case 'create_gig':
        setGigSource('post_delivery');
        setShowGigModal(true);
        break;
      case 'archive':
      case 'shred':
      case 'forward':
      case 'pay_bill':
      case 'create_task':
      case 'open_offer':
      case 'rsvp':
      case 'view_on_map':
      case 'share_to_community':
      case 'download':
      case 'link_to_asset':
      case 'custom':
        break;
      default:
        break;
    }
  }, [handleAcknowledge, handleTranslate]);

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="md:hidden px-4 py-3 border-b border-app-border-subtle">
          <div className="w-20 h-5 bg-app-surface-sunken rounded animate-pulse" />
        </div>
        <div className="px-6 py-5 border-b border-app-border-subtle">
          <div className="h-5 w-64 bg-app-surface-sunken rounded animate-pulse mb-3" />
          <div className="h-3 w-40 bg-app-surface-sunken rounded animate-pulse mb-2" />
          <div className="h-3 w-28 bg-app-surface-sunken rounded animate-pulse" />
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="h-3 w-full bg-app-surface-sunken rounded animate-pulse" />
          <div className="h-3 w-5/6 bg-app-surface-sunken rounded animate-pulse" />
          <div className="h-3 w-4/6 bg-app-surface-sunken rounded animate-pulse" />
          <div className="h-24 w-full bg-app-surface-sunken rounded animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error || !detail) {
    return (
      <div className="h-full flex flex-col">
        <div className="md:hidden px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <button
            type="button"
            onClick={() => router.push(`/app/mailbox/${drawer}`)}
            className="flex items-center gap-1 text-sm text-app-text-secondary hover:text-app-text-strong"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm font-semibold text-app-text mb-1">
              Couldn&apos;t load this item
            </p>
            <p className="text-xs text-app-text-secondary mb-4">
              {error?.message ?? 'Item not found'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Booklet detection ─────────────────────────────────────
  const isBooklet = detail.wrapper.mail_object_type === 'booklet';
  const bookletData: BookletItem | null = isBooklet ? {
    mail_id: detail.wrapper.id,
    page_count: wrapperAny?.page_count ?? 0,
    cover_image_url: wrapperAny?.cover_image_url,
    download_url: wrapperAny?.download_url,
    download_size_bytes: wrapperAny?.download_size_bytes,
    streaming_available: (wrapperAny?.download_size_bytes ?? 0) > 10 * 1024 * 1024,
    pages: wrapperAny?.pages ?? [],
  } : null;

  // ── Main render ───────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Mobile back button + toolbar ──────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-app-border-subtle flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push(`/app/mailbox/${drawer}`)}
          className="md:hidden p-1 text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* File to Vault button */}
        <div ref={vaultRef} className="relative">
          <button
            type="button"
            onClick={() => setVaultOpen(!vaultOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              fileToVault.isPending
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'border-app-border text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800'
            }`}
            disabled={fileToVault.isPending}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
            {fileToVault.isPending ? 'Filing...' : 'File to Vault'}
          </button>

          {vaultOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-app-surface border border-app-border rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
              {!vaultFolders || vaultFolders.length === 0 ? (
                <p className="px-3 py-2 text-xs text-app-text-muted">No vault folders yet</p>
              ) : (
                vaultFolders.map((folder: VaultFolder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleFileToVault(folder.id)}
                    className="w-full text-left px-3 py-2 text-sm text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    <span className="text-base">{folder.icon || '📁'}</span>
                    <span className="truncate">{folder.label}</span>
                    {folder.item_count > 0 && (
                      <span className="ml-auto text-[10px] text-app-text-muted">{folder.item_count}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* More actions */}
        <button
          type="button"
          className="p-1.5 text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300 hover:bg-app-hover dark:hover:bg-gray-800 rounded transition-colors"
          title="More actions"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable content ────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Family Mail Party banner — home drawer + presence detected */}
        {isSharedHome && currentUserId && (
          <FamilyMailParty
            itemId={itemId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            checkPresence={checkPresence}
            createParty={handleCreateParty}
            sendReaction={handleSendReaction}
            assignToMember={handleAssignMember}
            onReveal={() => setPartyRevealed(true)}
          />
        )}

        {/* Certified Mail Detail — replaces old CertifiedBanner */}
        {isCertified && certifiedItem && (
          <CertifiedMailDetail
            item={certifiedItem}
            currentUserId={currentUserId}
            recipientUserId={detail.wrapper.recipient_user_id}
            recipientName={detail.wrapper.recipient_name}
            auditTrail={auditTrail}
            proofPdfUrl={acknowledge.data?.proof_pdf_url}
            onAcknowledge={handleAcknowledge}
            acknowledging={acknowledge.isPending}
            acknowledged={acknowledge.isSuccess}
          />
        )}

        {/* Translation Banner — shown for non-English items (confidence > 0.85) */}
        {isNonEnglish && (
          <div className="px-6 py-3 border-b border-app-border-subtle flex-shrink-0">
            <TranslationBanner
              item={detail.wrapper as unknown as MailItemV2}
              detectedLanguage={langDetect?.detected_language}
              confidence={langDetect?.confidence}
              translatedContent={cachedTranslation?.content}
              onTranslate={handleTranslate}
              onShowOriginal={handleShowOriginal}
              loading={translate.isPending}
              showingTranslation={showTranslation}
            />
          </div>
        )}

        {/* "Translated from [Language]" indicator when showing translation */}
        {showTranslation && cachedTranslation && (
          <div className="px-6 py-2 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              Translated from {cachedTranslation.fromLanguage}
            </p>
            <button
              type="button"
              onClick={handleShowOriginal}
              className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              Show original
            </button>
          </div>
        )}

        {/* Booklet viewer replaces standard detail for booklet items */}
        {isBooklet && bookletData ? (
          <div className="flex-1 min-h-0">
            <BookletViewer
              booklet={bookletData}
              title={detail.wrapper.outside_title}
              sender={detail.wrapper.sender_display}
              onSaveToVault={() => setVaultOpen(true)}
              onDownload={() => {}}
              onShare={() => {}}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Translated content inline — replaces standard detail when active */}
            {showTranslation && cachedTranslation ? (
              <div className="px-6 py-4">
                <p className="text-sm text-app-text-strong whitespace-pre-wrap leading-relaxed">
                  {cachedTranslation.content}
                </p>

                {/* Postcard: show original as collapsible */}
                {isPostcard && (
                  <details className="mt-4">
                    <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
                      Original {cachedTranslation.fromLanguage}
                    </summary>
                    <div className="mt-2 p-3 bg-app-surface-raised rounded-lg">
                      <MailItemDetail
                        detail={detail}
                        onAction={handleAction}
                      />
                    </div>
                  </details>
                )}

                {/* Non-postcard: show original toggle at bottom */}
                {!isPostcard && (
                  <button
                    type="button"
                    onClick={handleShowOriginal}
                    className="mt-4 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                  >
                    Show original {cachedTranslation.fromLanguage}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Main detail component (original content) */}
                <MailItemDetail
                  detail={detail}
                  onAction={handleAction}
                />

                {/* Package Unboxing — shown when package is delivered */}
                {isDelivered && (
                  <PackageUnboxing
                    itemId={itemId}
                    deliveryPhoto={wrapperAny?.delivery_photo_url}
                    deliveryNote={wrapperAny?.delivery_location_note}
                    deliveredAt={wrapperAny?.delivered_at}
                    documentIds={
                      detail.inside.attachments
                        ?.filter((a) => a.mime_type?.includes('pdf') || a.filename?.match(/warranty|manual/i))
                        .map((a) => ({
                          type: a.filename?.match(/warranty/i) ? 'warranty' : 'manual',
                          fileId: a.id,
                          label: a.filename?.match(/warranty/i) ? 'Warranty' : 'Manual',
                        })) ?? []
                    }
                    vaultFolders={vaultFolders}
                    onUploadConditionPhoto={handleConditionPhotoUpload}
                    onSaveToVault={(fileId, folderId) => {
                      fileToVault.mutate({ itemId: fileId, folderId });
                    }}
                    onCreateGig={() => {
                      setGigSource('post_delivery');
                      setShowGigModal(true);
                    }}
                    onSkipUnboxing={async () => {
                      try {
                        await api.mailboxV2P2.recordUnboxing(itemId, { skip: true });
                      } catch {}
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Filed success message */}
        {fileToVault.isSuccess && (
          <div className="mx-6 mb-4 px-3 py-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg flex-shrink-0">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">
              Filed to vault successfully
            </p>
          </div>
        )}
      </div>

      {/* ── Gig creation modal ────────────────────────────── */}
      {showGigModal && (
        <GigCreationModal
          source={gigSource}
          packageTitle={detail.wrapper.outside_title}
          packageDescription={detail.inside.blocks?.[0]?.type === 'text' ? (detail.inside.blocks[0] as unknown as Record<string, any>).content as string : undefined}
          deliveryEta={wrapperAny?.eta_latest}
          homeAddress={wrapperAny?.delivery_address}
          photoUrl={wrapperAny?.delivery_photo_url}
          onGigCreated={() => {
            setShowGigModal(false);
          }}
          onClose={() => setShowGigModal(false)}
          createGig={handleCreatePackageGig}
        />
      )}
    </div>
  );
}
