'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { buildListingShareUrl } from '@pantopus/utils';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { REFRESH_COOLDOWN_DAYS, STATUS_OPTIONS } from './listing-detail.types';
import type { ListingDetail, ListingQuestion, ListingStatus, User } from '@pantopus/types';
import type { ListingOffer } from '@pantopus/api';

export function useListingDetail() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.id as string;

  // ── Core state ─────────────────────────────────────────────
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // A listing load that failed for any reason but "not found": the page can't say the listing is gone.
  const [loadError, setLoadError] = useState<string | null>(null);

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Q&A state
  const [questions, setQuestions] = useState<ListingQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const questionRequest = useRef(0);
  const questionScope = useRef(listingId);
  questionScope.current = listingId;

  useEffect(() => {
    const requests = questionRequest;
    setQuestions([]);
    setQuestionsError(null);
    return () => { requests.current++; };
  }, [listingId]);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Offer state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [existingOffer, setExistingOffer] = useState<ListingOffer | null>(null);
  // Offers still waiting on the seller or the handoff (the seller's "View Offers" count). For a seller the
  // offers read returns every offer on the listing; the listing payload carries no offer count.
  const [openOfferCount, setOpenOfferCount] = useState(0);

  const isOwner = !!(user?.id && listing?.user_id && String(user.id) === String(listing.user_id));

  // ── Fetch data ─────────────────────────────────────────────
  const fetchListing = useCallback(async () => {
    if (!listingId) return;
    try {
      const result = await api.listings.getListing(listingId);
      setListing(((result as Record<string, any>)?.listing ?? result) as ListingDetail);
      setLoadError(null);
    } catch (err) {
      setListing(null);
      setLoadError(
        (err as { statusCode?: number })?.statusCode === 404
          ? null
          : "Couldn't load this listing. Check your connection and try again."
      );
    }
  }, [listingId]);

  const retryLoad = useCallback(async () => {
    setLoading(true);
    await fetchListing();
    setLoading(false);
  }, [fetchListing]);

  const fetchQuestions = useCallback(async () => {
    if (!listingId) return;
    const request = ++questionRequest.current;
    const token = getAuthToken();
    const session = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const isCurrent = () => request === questionRequest.current
      && listingId === questionScope.current
      && token === getAuthToken()
      && session === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const result = await api.listings.getListingQuestions(listingId);
      if (isCurrent()) setQuestions(result?.questions || []);
    } catch {
      if (isCurrent()) setQuestionsError('Could not load questions. Please try again.');
    } finally {
      if (isCurrent()) setQuestionsLoading(false);
    }
  }, [listingId]);

  const fetchExistingOffer = useCallback(async (userId?: string) => {
    if (!listingId) return;
    try {
      const { offers } = await api.listings.getListingOffers(listingId);
      const myOffer = offers.find(
        (o: ListingOffer) => o.buyer_id === userId && ['pending', 'countered', 'accepted'].includes(o.status)
      );
      setExistingOffer(myOffer || null);
      setOpenOfferCount(
        offers.filter((o: ListingOffer) => ['pending', 'countered', 'accepted'].includes(o.status)).length
      );
    } catch {
      setExistingOffer(null);
      setOpenOfferCount(0);
    }
  }, [listingId]);

  const handleOfferSent = useCallback(async () => {
    setShowOfferModal(false);
    await fetchListing();
    if (user?.id) await fetchExistingOffer(user.id);
  }, [fetchListing, fetchExistingOffer, user?.id]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    const fetchUser = async () => {
      try {
        const u = await api.users.getMyProfile();
        setUser(u);
        return u;
      } catch { return null; }
    };

    setLoading(true);
    Promise.all([fetchUser(), fetchListing(), fetchQuestions()]).then(([u]) => {
      if (u?.id) fetchExistingOffer(u.id);
    }).finally(() => setLoading(false));
  }, [fetchListing, fetchQuestions, fetchExistingOffer, router]);

  // ── Actions ────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => api.listings.toggleSave(listingId),
    onMutate: () => {
      const wasSaved = listing?.userHasSaved ?? false;
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          userHasSaved: !wasSaved,
          save_count: wasSaved ? (prev.save_count || 1) - 1 : (prev.save_count || 0) + 1,
        };
      });
      return { wasSaved };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      const { wasSaved } = context;
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          userHasSaved: wasSaved,
          save_count: wasSaved ? (prev.save_count || 0) + 1 : (prev.save_count || 1) - 1,
        };
      });
    },
  });

  const handleSave = () => {
    if (!listing) return;
    saveMutation.mutate();
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const sellerId = listing?.user_id || listing?.creator?.id;
      if (!sellerId) throw new Error('Could not identify seller');
      const { roomId } = await api.chat.createDirectChat(sellerId);
      await api.chat.sendMessage({
        roomId,
        messageText: text,
        messageType: 'listing_offer',
        metadata: {
          listingId,
          listingTitle: listing?.title,
          listingPrice: listing?.price,
          listingImage: listing?.media_urls?.[0],
        },
      });
      return { sellerId };
    },
    onMutate: () => setSendingMessage(true),
    onSuccess: ({ sellerId }) => {
      setShowMessageModal(false);
      setMessageText('');
      router.push(`/app/chat/conversation/${sellerId}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to send message.';
      toast.error(msg);
    },
    onSettled: () => setSendingMessage(false),
  });

  const handleSendMessage = () => {
    const text = messageText.trim();
    if (!text) return;
    sendMessageMutation.mutate(text);
  };

  const handleShare = async () => {
    const url = buildListingShareUrl(listingId);
    const title = listing?.title || 'Listing';
    const price = listing?.is_free ? 'Free' : listing?.price != null ? `$${Number(listing.price).toFixed(0)}` : '';
    const text = `${title}${price ? ` — ${price}` : ''} on Pantopus`;

    if (navigator.share) {
      try { await navigator.share({ title, text, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleStatusChange = async (status: string) => {
    // Sold and archived take the listing off the marketplace (browse lists active listings only), so ask first.
    if (status === 'sold' || status === 'archived') {
      const yes = await confirmStore.open({
        title: status === 'sold' ? 'Mark this listing sold?' : 'Archive this listing?',
        description: 'It comes off the marketplace and stops taking offers.',
        confirmLabel: status === 'sold' ? 'Mark sold' : 'Archive',
        variant: status === 'sold' ? 'primary' : 'destructive',
      });
      if (!yes) return;
    }
    try {
      await api.listings.updateListingStatus(listingId, status as ListingStatus);
      await fetchListing();
      toast.success(`Listing marked ${status.replace(/_/g, ' ')}.`);
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleShareToFeed = async () => {
    try {
      await api.listings.shareToFeed(listingId, { content: `Check out: ${listing?.title}` });
      toast.success('Shared to Neighborhood!');
    } catch {
      toast.error('Failed to share.');
    }
  };

  type ReportReason = 'spam' | 'prohibited' | 'counterfeit' | 'scam' | 'other';
  const handleReport = async (reason: string, details?: string) => {
    try {
      await api.listings.reportListing(listingId, { reason: reason as ReportReason, details });
      toast.success('Report submitted. Thank you.');
    } catch (err) {
      toast.error('Failed to submit report.');
      throw err;
    }
  };

  // ── Refresh handler ──────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.listings.refreshListing(listingId);
      await fetchListing();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh listing.');
    } finally {
      setRefreshing(false);
    }
  };

  const canRefresh = isOwner && listing && (() => {
    if (!listing.last_refreshed_at) return true;
    const diff = Date.now() - new Date(listing.last_refreshed_at).getTime();
    return diff >= REFRESH_COOLDOWN_DAYS * 86400000;
  })();

  // ── Q&A handlers ───────────────────────────────────────────
  const handleAskQuestion = async (questionText: string) => {
    try {
      await api.listings.askListingQuestion(listingId, questionText);
      await fetchQuestions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post question');
      throw err;
    }
  };

  const handleAnswerQuestion = async (questionId: string, answerText: string) => {
    try {
      await api.listings.answerListingQuestion(listingId, questionId, answerText);
      await fetchQuestions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to answer');
      throw err;
    }
  };

  const handleUpvote = async (questionId: string) => {
    try { await api.listings.toggleUpvoteListingQuestion(listingId, questionId); await fetchQuestions(); } catch {}
  };

  const handlePin = async (questionId: string) => {
    try { await api.listings.togglePinListingQuestion(listingId, questionId); await fetchQuestions(); } catch {}
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const yes = await confirmStore.open({ title: 'Delete this question?', description: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try { await api.listings.deleteListingQuestion(listingId, questionId); await fetchQuestions(); } catch {}
  };

  return {
    // State
    listing,
    user,
    loading,
    loadError,
    retryLoad,
    listingId,
    isOwner,
    questions,
    questionsLoading,
    questionsError,
    retryQuestions: fetchQuestions,
    refreshing,
    canRefresh: !!canRefresh,

    // Message modal state
    showMessageModal,
    setShowMessageModal,
    messageText,
    setMessageText,
    sendingMessage,

    // Report modal state
    showReportModal,
    setShowReportModal,

    // Offer modal state
    showOfferModal,
    setShowOfferModal,
    existingOffer,
    openOfferCount,
    handleOfferSent,

    // Actions
    handleSave,
    handleSendMessage,
    handleShare,
    handleStatusChange,
    handleShareToFeed,
    handleReport,
    handleRefresh,

    // Q&A actions
    handleAskQuestion,
    handleAnswerQuestion,
    handleUpvote,
    handlePin,
    handleDeleteQuestion,

    // Navigation
    router,
  };
}
