'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import type { CertifiedMail, BookletItem, AuditEvent, PartyParticipant, MailboxHome } from '@/types/mailbox';
import * as api from '@pantopus/api';
import {
  useItemDetail,
  useMailboxDrawers,
  useMarkItemOpened,
  useFileItemToVault,
  useAcknowledgeCertifiedMail,
  useVaultFolders,
  useRestoreMail,
  useBooklet,
} from '@/lib/mailbox-queries';
import VerifyPromptSheet from '@/components/place/VerifyPromptSheet';
import { isMailboxDrawer } from '@/components/mailbox/MailboxHeader';
import LetterView from '@/components/mailbox/LetterView';
import BundlePieces from '@/components/mailbox/BundlePieces';
import LetterActions from '@/components/mailbox/LetterActions';
import SenderSheet from '@/components/mailbox/SenderSheet';
import MailPiece, { pieceKind } from '@/components/mailbox/MailPiece';
import useMailAddressee from '@/components/mailbox/useMailAddressee';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import { toast } from '@/components/ui/toast-store';
import BookletViewer from '@/components/mailbox/BookletViewer';
import PackageUnboxing from '@/components/mailbox/PackageUnboxing';
import GigCreationModal from '@/components/mailbox/GigCreationModal';
import FamilyMailParty from '@/components/mailbox/FamilyMailParty';
import CertifiedMailDetail from '@/components/mailbox/CertifiedMailDetail';
import HolidayCardView from '@/components/mailbox/cards/HolidayCardView';
import { launchFeatures } from '@/lib/featureFlags';
import { chosenUsername } from '@pantopus/utils';
import { fetchMe } from '@/lib/me';

/**
 * Mail item detail page — right pane on desktop, full page on mobile.
 *
 * Fetches the full MailItemDetailResponse on mount, marks it opened
 * if unread, and renders blocks, actions, certified banner,
 * file-to-vault, package unboxing, family mail party,
 * and certified mail audit trail. Mail translation isn't offered: the
 * backend has no translation provider yet.
 */
export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams<{ drawer: string; item_id: string }>();
  const drawer = params.drawer;
  const itemId = params.item_id;

  // ── Data fetching ─────────────────────────────────────────
  const { data: detail, isLoading, error, refetch } = useItemDetail(itemId);
  const markOpened = useMarkItemOpened();

  // A link that didn't know the letter's drawer (a notification's
  // /app/mailbox/<id> opens it in Me) moves to the letter's own drawer, so
  // the list beside it and the drawer chips match the letter.
  const ownDrawer = detail?.wrapper.drawer;
  useEffect(() => {
    if (ownDrawer && ownDrawer !== drawer && isMailboxDrawer(ownDrawer)) {
      router.replace(`/app/mailbox/${ownDrawer}/${itemId}`);
    }
  }, [ownDrawer, drawer, itemId, router]);

  // A Christmas card opens from its envelope the first time: the load that opened it says so (just_opened; the
  // list's tap may have loaded it first). Kept per letter for this visit.
  const [cardFirstOpen, setCardFirstOpen] = useState<{ id: string; first: boolean } | null>(null);
  useEffect(() => {
    if (!detail || detail.wrapper.id !== itemId || cardFirstOpen?.id === itemId) return;
    setCardFirstOpen({ id: itemId, first: Boolean(detail.piece.just_opened) || !detail.wrapper.opened_at });
  }, [detail, itemId, cardFirstOpen]);

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
    fetchMe().then(u => {
      if (cancelled) return;
      setCurrentUserId(u.id);
      setCurrentUserName(u.name || chosenUsername(u.username) || 'You');
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
    acknowledged_at: acknowledge.data?.acknowledged_at ?? detail.wrapper.acknowledged_at,
    acknowledged_by: undefined,
    audit_trail: acknowledge.data?.audit_trail ?? detail.wrapper.audit_trail ?? [],
  } : null;

  const auditTrail: AuditEvent[] = acknowledge.data?.audit_trail ?? certifiedItem?.audit_trail ?? [];

  // ── Package unboxing's Vault (Household extras) ──────────
  const { data: vaultFolders } = useVaultFolders({ enabled: launchFeatures.householdExtras });
  const fileToVault = useFileItemToVault();

  // ── Who it's addressed to; the envelope sheet; a booklet's pages ──
  const { addressee, timeZone } = useMailAddressee();
  const [sheetOpen, setSheetOpen] = useState(false);
  const booklet = useBooklet(itemId, !!detail && pieceKind(detail.piece) === 'booklet');

  // ── A Home letter waiting on proof: which Home to verify ──
  const { data: drawers } = useMailboxDrawers();
  const [verifyHome, setVerifyHome] = useState<MailboxHome | null>(null);

  // ── Package / Unboxing ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapperAny = detail?.wrapper as any;
  const isPackage = detail?.wrapper.mail_object_type === 'package';
  const isDelivered = isPackage && (wrapperAny?.status === 'delivered' || wrapperAny?.package_status === 'delivered');
  const [showGigModal, setShowGigModal] = useState(false);
  const [gigSource, setGigSource] = useState<'post_delivery' | 'pre_delivery'>('post_delivery');

  // As the iOS and Android apps do: store the photo, then record it on the
  // package (the server has no single condition-photo upload route).
  const handleConditionPhotoUpload = useCallback(async (file: File) => {
    try {
      const upload = await api.uploadFile<{ file: { url: string } }>('/api/files/upload', file, {
        file_type: 'mailbox_unboxing',
        visibility: 'private',
      });
      await api.mailboxV2P2.recordUnboxing(itemId, { conditionPhotoUrl: upload.file.url });
    } catch (err) {
      toast.error("Couldn't attach the photo — try again");
      throw err;
    }
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

  // ── Deleted or dismissed letter ───────────────────────────
  // Members who could see it open it from the notice and can restore it; a
  // deleted letter refuses every other action until then.
  const removed = detail?.wrapper.removed;
  const isDeleted = removed?.action === 'deleted';
  const shredByMe = isDeleted && Boolean(currentUserId) && detail?.piece.deleted_by === currentUserId;
  const restore = useRestoreMail();
  const handleRestore = useCallback(() => {
    restore.mutate(itemId, {
      onSuccess: () => toast.success('Brought back to your mail'),
      onError: (err) => toast.error(`Couldn't bring it back. ${mailLoadMessage(err)}`),
    });
  }, [restore, itemId]);
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

  // ── Couldn't open it ──────────────────────────────────────
  // Home mail waiting on proof says so and opens the address check; mail that
  // isn't yours (or is gone) says so plainly; only a failure offers Try again.
  if (error || !detail) {
    const needsProof = error?.serverCode === 'MAIL_HOME_NEEDS_PROOF';
    const notHere = !needsProof && (error?.status === 404 || error?.status === 403);
    const toProve = (drawers?.homes ?? []).filter((home) => home.mail_access === 'needs_proof');
    const button = 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors';
    return (
      <div className="h-full flex flex-col">
        <div className="md:hidden px-2 py-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => router.push(`/app/mailbox/${drawer}`)}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-app-text-secondary hover:bg-app-hover hover:text-app-text"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Mail
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div role="alert" className="text-center max-w-sm">
            <h1 className="text-base font-semibold text-app-text mb-1">
              {needsProof ? "Your home's mail is waiting" : notHere ? "This mail isn't here" : "Couldn't open this mail"}
            </h1>
            <p className="text-sm text-app-text-secondary mb-4">{mailLoadMessage(error)}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {needsProof ? (toProve.length ? toProve.map((home) => (
                <button
                  key={home.home_id}
                  type="button"
                  onClick={() => setVerifyHome(home)}
                  className={`${button} bg-primary-600 text-white hover:bg-primary-700`}
                >
                  {toProve.length > 1 ? `Verify ${home.address_line}` : 'Verify your home'}
                </button>
              )) : (
                <button type="button" onClick={() => router.push('/app/place')} className={`${button} bg-primary-600 text-white hover:bg-primary-700`}>
                  Verify your home
                </button>
              )) : notHere ? (
                <button type="button" onClick={() => router.push(`/app/mailbox/${drawer}`)} className={`${button} bg-primary-600 text-white hover:bg-primary-700`}>
                  Back to your mail
                </button>
              ) : (
                <button type="button" onClick={() => { void refetch(); }} className={`${button} bg-primary-600 text-white hover:bg-primary-700`}>
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
        {/* On the document body, above the phone tab bar. */}
        {verifyHome ? createPortal(
          <VerifyPromptSheet
            open
            onClose={() => setVerifyHome(null)}
            homeId={verifyHome.home_id}
            address={verifyHome.address_line}
          />,
          document.body,
        ) : null}
      </div>
    );
  }

  // ── The piece ─────────────────────────────────────────────
  const piece = detail.piece;
  const to = addressee(piece);
  const isBooklet = pieceKind(piece) === 'booklet';
  const bookletPages = booklet.data?.pages ?? [];
  const bookletData: BookletItem | null = isBooklet && bookletPages.length > 0 ? {
    mail_id: piece.id,
    // The pages it actually has (page_count can promise more than were scanned).
    page_count: bookletPages.length,
    cover_image_url: booklet.data?.cover_image_url,
    download_url: booklet.data?.download_url,
    download_size_bytes: booklet.data?.download_size_bytes,
    streaming_available: (booklet.data?.download_size_bytes ?? 0) > 10 * 1024 * 1024,
    pages: bookletPages,
  } : null;

  // ── Main render ───────────────────────────────────────────
  return (
    <div className="flex h-full flex-col md:overflow-hidden">
      {/* Phones: back to the list (wider screens keep the list beside the letter) */}
      <div className="flex flex-shrink-0 items-center px-2 py-1.5 md:hidden">
        <button
          type="button"
          onClick={() => router.push(`/app/mailbox/${drawer}`)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-app-text-secondary hover:bg-app-hover hover:text-app-text"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Mail
        </button>
      </div>

      <div className="flex-1 md:min-h-0 md:overflow-y-auto">
        {/* Shredded or dismissed — bring it back */}
        {removed && (
          <div
            className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3"
            role="status"
          >
            <p className="flex-1 min-w-0 text-sm text-amber-700 font-medium">
              {removed.action === 'deleted'
                ? `${`Shredded${shredByMe ? ' by you' : removed.by_name ? ` by ${removed.by_name}` : ''}`.replace(/\.?$/, '.')}${removed.restorable_until
                  ? ` You can bring it back until ${new Date(removed.restorable_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`
                  : ''}`
                : 'Dismissed for the household. You can bring it back.'}
            </p>
            <button
              type="button"
              onClick={handleRestore}
              disabled={restore.isPending}
              className="flex-shrink-0 min-h-[44px] px-2 text-sm font-semibold text-amber-800 hover:underline disabled:opacity-60"
            >
              {restore.isPending ? 'Bringing it back…' : 'Bring it back'}
            </button>
          </div>
        )}

        {/* Family Mail Party banner — home drawer + presence detected */}
        {/* Launch cut #8 (Mail extras): the Family Mail Party and certified mail are hidden. */}
        {launchFeatures.mailExtras && isSharedHome && currentUserId && !isDeleted && (
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
        {launchFeatures.mailExtras && isCertified && certifiedItem && (
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

        {/* A booklet with pages pages through; otherwise the piece reads as a letter */}
        {bookletData ? (
          <div className="min-h-[60vh]">
            {/* The booklet as it came: tap it for who sent it and its trail */}
            <div className="mx-auto w-full max-w-2xl px-4 pt-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={`Booklet from ${piece.sender_display || 'Unknown sender'}. Show who sent it and its trail`}
                className="block w-full max-w-[358px] rounded-lg text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <MailPiece item={piece} recipientName={to.name} recipientLine={to.line} opened />
              </button>
            </div>
            <BookletViewer
              booklet={bookletData}
              title={detail.wrapper.outside_title}
              sender={detail.wrapper.sender_display}
              // The Download link opens the file itself; this only records the download.
              onDownload={bookletData.download_url ? () => { void api.mailboxV2P2.downloadBooklet(piece.id).catch(() => {}); } : undefined}
            />
          </div>
        ) : piece.card ? (
          <HolidayCardView
            key={piece.id}
            piece={piece}
            recipientName={to.name}
            recipientLine={to.line}
            firstOpen={cardFirstOpen?.id === itemId ? cardFirstOpen.first : Boolean(piece.just_opened) || !detail.wrapper.opened_at}
            onOpenEnvelope={() => setSheetOpen(true)}
          />
        ) : (
          <LetterView
            piece={piece}
            recipientName={to.name}
            recipientLine={to.line}
            onOpenEnvelope={() => setSheetOpen(true)}
          />
        )}

        {/* A bundle: what came in it, each opening as its own letter */}
        {pieceKind(piece) === 'bundle' ? (
          <section aria-label="In this bundle" className="mx-auto w-full max-w-2xl px-4 pb-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-app-text-secondary">In this bundle</h2>
            <BundlePieces
              bundleId={piece.id}
              addressee={addressee}
              timeZone={timeZone}
              onOpen={(inside) => router.push(`/app/mailbox/${inside.drawer}/${inside.id}`)}
            />
          </section>
        ) : null}

        {/* Package Unboxing — shown when package is delivered */}
        {/* Launch cut #7 (Household extras): package tracking and media are hidden. */}
        {launchFeatures.householdExtras && isDelivered && (
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
      </div>

      {/* What to do with it, in mail words */}
      <LetterActions piece={piece} />

      {sheetOpen && (
        <SenderSheet piece={piece} recipientName={to.name} recipientLine={to.line} onClose={() => setSheetOpen(false)} />
      )}

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
