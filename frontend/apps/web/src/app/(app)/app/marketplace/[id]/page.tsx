// @ts-nocheck
'use client';

import { useState } from 'react';
import { Frown } from 'lucide-react';
import ReportModal from '@/components/ui/ReportModal';
import { useListingDetail } from './_components/useListingDetail';
import ListingGallery from './_components/ListingGallery';
import ListingInfo from './_components/ListingInfo';
import PriceContext from './_components/PriceContext';
import SellerSection from './_components/SellerSection';
import MeetupDeliveryCard from './_components/MeetupDeliveryCard';
import ListingActions from './_components/ListingActions';
import QASection from './_components/QASection';
import SimilarListings from './_components/SimilarListings';
import MessageSellerModal from './_components/MessageSellerModal';
import OfferModal from './_components/OfferModal';
import TradeModal from './_components/TradeModal';
import ReviewModal from './_components/ReviewModal';

export default function ListingDetailPage() {
  const {
    listing,
    user,
    loading,
    listingId,
    isOwner,
    questions,
    questionsLoading,
    refreshing,
    canRefresh,

    showMessageModal,
    setShowMessageModal,
    messageText,
    setMessageText,
    sendingMessage,

    showReportModal,
    setShowReportModal,

    showOfferModal,
    setShowOfferModal,
    existingOffer,
    handleOfferSent,

    handleSave,
    handleSendMessage,
    handleShare,
    handleStatusChange,
    handleShareToFeed,
    handleReport,
    handleRefresh,

    handleAskQuestion,
    handleAnswerQuestion,
    handleUpvote,
    handlePin,
    handleDeleteQuestion,

    router,
  } = useListingDetail();

  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-app-text-secondary">Loading listing...</p>
        </div>
      </div>
    );
  }

  // ── Not found state ────────────────────────────────────────
  if (!listing) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center"><Frown className="w-12 h-12 text-app-text-muted" /></div>
          <h2 className="text-xl font-semibold text-app-text mb-2">Listing not found</h2>
          <p className="text-app-text-secondary mb-4">This listing may have been removed or doesn&apos;t exist.</p>
          <button onClick={() => router.push('/app/marketplace')} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const images: string[] = listing.media_urls || [];

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-app-text-secondary hover:text-app-text mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Marketplace
        </button>

        <ListingGallery images={images} title={listing.title} />

        <ListingInfo listing={listing} />

        <PriceContext
          category={listing.category}
          latitude={listing.latitude ?? listing.location?.latitude}
          longitude={listing.longitude ?? listing.location?.longitude}
          currentPrice={Number(listing.price) || undefined}
          isFree={listing.is_free}
        />

        <ListingActions
          listing={listing}
          listingId={listingId}
          isOwner={isOwner}
          canRefresh={canRefresh}
          refreshing={refreshing}
          onSave={handleSave}
          onShare={handleShare}
          onShareToFeed={handleShareToFeed}
          onRefresh={handleRefresh}
          onStatusChange={handleStatusChange}
          onMessageSeller={() => setShowMessageModal(true)}
          onReport={() => setShowReportModal(true)}
          onMakeOffer={() => setShowOfferModal(true)}
          activeOfferCount={listing.active_offer_count || 0}
          listingIsFree={listing.is_free}
          hasExistingOffer={!!existingOffer}
        />

        <SellerSection listing={listing} />

        <MeetupDeliveryCard
          meetupPreference={listing.meetup_preference}
          deliveryAvailable={listing.delivery_available}
          isAddressAttached={listing.is_address_attached}
        />

        {listing.open_to_trades && !isOwner && (
          <div className="mb-6">
            <button onClick={() => setShowTradeModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border border-emerald-500 text-emerald-600 rounded-xl font-semibold text-sm hover:bg-emerald-50 transition">
              &#x1F501; Propose a Trade
            </button>
          </div>
        )}

        {listing.status === 'sold' && !isOwner && listing.buyer_id === user?.id && !listing.buyer_reviewed && (
          <div className="mb-6">
            <button onClick={() => setShowReviewModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl font-semibold text-sm hover:bg-amber-100 transition">
              &#11088; Leave a Review
            </button>
          </div>
        )}

        <QASection
          listing={listing}
          user={user}
          isOwner={isOwner}
          questions={questions}
          questionsLoading={questionsLoading}
          onAskQuestion={handleAskQuestion}
          onAnswerQuestion={handleAnswerQuestion}
          onUpvote={handleUpvote}
          onPin={handlePin}
          onDeleteQuestion={handleDeleteQuestion}
        />

        <SimilarListings listingId={listingId} />
      </main>

      {/* Message Seller Modal */}
      {showMessageModal && (
        <MessageSellerModal
          listing={listing}
          messageText={messageText}
          sendingMessage={sendingMessage}
          onMessageTextChange={setMessageText}
          onSend={handleSendMessage}
          onClose={() => setShowMessageModal(false)}
        />
      )}

      {/* Offer Modal */}
      {showOfferModal && (
        <OfferModal
          listing={listing}
          existingOffer={existingOffer}
          onOfferSent={handleOfferSent}
          onClose={() => setShowOfferModal(false)}
        />
      )}

      {/* Trade Modal */}
      <TradeModal
        open={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        listing={listing}
        onTradeProposed={handleStatusChange}
      />

      {/* Review Modal */}
      <ReviewModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        reviewedId={listing.user_id || listing.seller_id || ''}
        reviewedName={listing.seller?.name || listing.seller?.username || 'the seller'}
        listingId={listingId}
        context="listing_sale"
        onReviewSubmitted={handleStatusChange}
      />

      {/* Report Modal */}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        entityType="listing"
      />
    </div>
  );
}
