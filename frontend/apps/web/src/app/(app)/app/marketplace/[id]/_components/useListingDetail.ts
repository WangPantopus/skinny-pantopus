'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Q&A state
  const [questions, setQuestions] = useState<ListingQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Offer state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [existingOffer, setExistingOffer] = useState<ListingOffer | null>(null);

  const isOwner = !!(user?.id && listing?.user_id && String(user.id) === String(listing.user_id));

  // ── Fetch data ─────────────────────────────────────────────
  const fetchListing = useCallback(async () => {
    if (!listingId) return;
    try {
      const result = await api.listings.getListing(listingId);
      setListing(((result as Record<string, any>)?.listing ?? result) as ListingDetail);
    } catch {
      setListing(null);
    }
  }, [listingId]);

  const fetchQuestions = useCallback(async () => {
    if (!listingId) return;
    setQuestionsLoading(true);
    try {
      const result = await api.listings.getListingQuestions(listingId);
      setQuestions(result?.questions || []);
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
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
    } catch {
      setExistingOffer(null);
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
      return { roomId };
    },
    onMutate: () => setSendingMessage(true),
    onSuccess: ({ roomId }) => {
      setShowMessageModal(false);
      setMessageText('');
      router.push(`/app/chat?room=${roomId}`);
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
    try {
      await api.listings.updateListingStatus(listingId, status as ListingStatus);
      await fetchListing();
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
    } catch {
      toast.error('Failed to submit report.');
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
    listingId,
    isOwner,
    questions,
    questionsLoading,
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
