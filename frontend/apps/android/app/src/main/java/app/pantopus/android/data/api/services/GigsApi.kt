package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.AnswerGigQuestionBody
import app.pantopus.android.data.api.models.gigs.AskGigQuestionBody
import app.pantopus.android.data.api.models.gigs.BoostGigResponse
import app.pantopus.android.data.api.models.gigs.CancelGigBody
import app.pantopus.android.data.api.models.gigs.CancellationPreviewResponse
import app.pantopus.android.data.api.models.gigs.CompleteGigResponse
import app.pantopus.android.data.api.models.gigs.CounterBidBody
import app.pantopus.android.data.api.models.gigs.CreateChangeOrderBody
import app.pantopus.android.data.api.models.gigs.CreateGigBody
import app.pantopus.android.data.api.models.gigs.CreateGigResponse
import app.pantopus.android.data.api.models.gigs.DismissGigBody
import app.pantopus.android.data.api.models.gigs.GigActionSuccessResponse
import app.pantopus.android.data.api.models.gigs.GigBidAcceptResponse
import app.pantopus.android.data.api.models.gigs.GigBidMutationResponse
import app.pantopus.android.data.api.models.gigs.GigBidsResponse
import app.pantopus.android.data.api.models.gigs.GigChangeOrderMutationResponse
import app.pantopus.android.data.api.models.gigs.GigChangeOrdersResponse
import app.pantopus.android.data.api.models.gigs.GigChatRoomResponse
import app.pantopus.android.data.api.models.gigs.GigDetailResponse
import app.pantopus.android.data.api.models.gigs.GigInstantAcceptResponse
import app.pantopus.android.data.api.models.gigs.GigPaymentResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionMutationResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionsResponse
import app.pantopus.android.data.api.models.gigs.GigSaveResponse
import app.pantopus.android.data.api.models.gigs.GigTemplatesResponse
import app.pantopus.android.data.api.models.gigs.GigsBrowseResponse
import app.pantopus.android.data.api.models.gigs.GigsInBoundsResponse
import app.pantopus.android.data.api.models.gigs.GigsListResponse
import app.pantopus.android.data.api.models.gigs.HiddenCategoryBody
import app.pantopus.android.data.api.models.gigs.MagicDraftRequest
import app.pantopus.android.data.api.models.gigs.MagicDraftResponse
import app.pantopus.android.data.api.models.gigs.MagicPostBody
import app.pantopus.android.data.api.models.gigs.MagicPostResponse
import app.pantopus.android.data.api.models.gigs.MagicUndoResponse
import app.pantopus.android.data.api.models.gigs.MarkCompletedBody
import app.pantopus.android.data.api.models.gigs.MarkCompletedResponse
import app.pantopus.android.data.api.models.gigs.MyGigsResponse
import app.pantopus.android.data.api.models.gigs.NoShowCheckResponse
import app.pantopus.android.data.api.models.gigs.PlaceBidBody
import app.pantopus.android.data.api.models.gigs.PlaceBidResponse
import app.pantopus.android.data.api.models.gigs.PriceBenchmarkResponse
import app.pantopus.android.data.api.models.gigs.RejectChangeOrderBody
import app.pantopus.android.data.api.models.gigs.ReportGigBody
import app.pantopus.android.data.api.models.gigs.ReportGigResponse
import app.pantopus.android.data.api.models.gigs.ReportNoShowBody
import app.pantopus.android.data.api.models.gigs.ReportNoShowResponse
import app.pantopus.android.data.api.models.gigs.RescheduleGigBody
import app.pantopus.android.data.api.models.gigs.RescheduleGigResponse
import app.pantopus.android.data.api.models.gigs.WorkerAckBody
import app.pantopus.android.data.api.models.gigs.WorkerAckResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Gig endpoints from `backend/routes/gigs.js`. Mounted at `/api/gigs`
 * (see `backend/app.js:308`).
 */
@Suppress("TooManyFunctions")
interface GigsApi {
    /**
     * `GET /api/gigs` — paginated browse with category + sort filters.
     * Excludes the caller's own gigs by default. `schedule_type` takes a
     * single value, `pay_type` takes `offers` for open-to-bids, and
     * `deadline` accepts `today` / `tomorrow` / `this_week`.
     *
     * `user_id` scopes the feed to one poster and suppresses the
     * "exclude my own gigs" branch (`backend/routes/gigs.js:2103-2125`,
     * applied at `:2473`) — the public-profile Gigs tab's only filter.
     */
    @Suppress("LongParameterList")
    @GET("api/gigs")
    suspend fun list(
        @Query("category") category: String? = null,
        @Query("user_id") userId: String? = null,
        @Query("sort") sort: String? = null,
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null,
        @Query("radiusMiles") radiusMiles: Double? = null,
        @Query("includeRemote") includeRemote: Boolean? = null,
        @Query("minPrice") minPrice: Double? = null,
        @Query("maxPrice") maxPrice: Double? = null,
        @Query("schedule_type") scheduleType: String? = null,
        @Query("pay_type") payType: String? = null,
        @Query("deadline") deadline: String? = null,
        @Query("max_distance") maxDistanceMeters: Int? = null,
        @Query("task_archetype") taskArchetype: String? = null,
        @Query("search") search: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
    ): GigsListResponse

    /**
     * `POST /api/gigs/magic-draft` — backend NLP parse of the Magic Task
     * describe text into a structured gig draft. Replaces the on-device
     * keyword matcher (which remains the offline fallback).
     */
    @POST("api/gigs/magic-draft")
    suspend fun magicDraft(
        @Body body: MagicDraftRequest,
    ): MagicDraftResponse

    /**
     * `POST /api/gigs/magic-post` — create a gig from a magic/classic
     * draft with a 10s undo window. Route `backend/routes/magicTask.js:397`.
     * A12.8 — replaces `POST /api/gigs` for the Post-a-Task wizard.
     */
    @POST("api/gigs/magic-post")
    suspend fun magicPost(
        @Body body: MagicPostBody,
    ): MagicPostResponse

    /**
     * `POST /api/gigs/:gigId/undo` — delete a just-posted gig within its
     * undo window. Route `backend/routes/magicTask.js:682`.
     */
    @POST("api/gigs/{gigId}/undo")
    suspend fun undoMagicPost(
        @Path("gigId") gigId: String,
    ): MagicUndoResponse

    /**
     * `GET /api/gigs/templates/library` — static smart-template chips for
     * the empty describe state. Route `backend/routes/magicTask.js:326`.
     */
    @GET("api/gigs/templates/library")
    suspend fun templatesLibrary(): GigTemplatesResponse

    /**
     * `GET /api/gigs/browse` — pre-sectioned browse feed (best matches,
     * urgent, clusters, high paying, new today, quick jobs). Route
     * `backend/routes/gigs.js:3190`. `radius` is meters; the server
     * defaults to ~100 mi when omitted.
     */
    @GET("api/gigs/browse")
    suspend fun browse(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius") radiusMeters: Int? = null,
    ): GigsBrowseResponse

    /**
     * `GET /api/gigs/price-benchmark` — completed-gig price percentiles
     * for a category. Route `backend/routes/gigs.js:2985`. `lat`/`lng`
     * are accepted but unused server-side in the MVP.
     */
    @GET("api/gigs/price-benchmark")
    suspend fun priceBenchmark(
        @Query("category") category: String,
        @Query("lat") lat: Double? = null,
        @Query("lng") lng: Double? = null,
    ): PriceBenchmarkResponse

    /**
     * `POST /api/gigs/:gigId/dismiss` — "Not interested". Records an
     * affinity signal + stores the dismissal. Route
     * `backend/routes/gigs.js:8523`.
     */
    @POST("api/gigs/{gigId}/dismiss")
    suspend fun dismissGig(
        @Path("gigId") gigId: String,
        @Body body: DismissGigBody,
    ): GigActionSuccessResponse

    /** `DELETE /api/gigs/:gigId/dismiss` — undo. Route `backend/routes/gigs.js:8572`. */
    @DELETE("api/gigs/{gigId}/dismiss")
    suspend fun undoDismissGig(
        @Path("gigId") gigId: String,
    ): GigActionSuccessResponse

    /**
     * `POST /api/gigs/hidden-categories` — hide a whole category from
     * the viewer's feeds. Route `backend/routes/gigs.js:3461`.
     */
    @POST("api/gigs/hidden-categories")
    suspend fun hideCategory(
        @Body body: HiddenCategoryBody,
    ): GigActionSuccessResponse

    /** `DELETE /api/gigs/hidden-categories/:category` — unhide. Route `backend/routes/gigs.js:3495`. */
    @DELETE("api/gigs/hidden-categories/{category}")
    suspend fun unhideCategory(
        @Path("category") category: String,
    ): GigActionSuccessResponse

    /** `GET /api/gigs/nearby` — radius search in meters. */
    @GET("api/gigs/nearby")
    suspend fun nearby(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radiusMeters: Int = 5_000,
        @Query("status") status: String = "open",
        @Query("limit") limit: Int = 20,
    ): GigsListResponse

    /** `GET /api/gigs/in-bounds` — map-viewport pins for T2.4. */
    @GET("api/gigs/in-bounds")
    suspend fun inBounds(
        @Query("min_lat") minLat: Double,
        @Query("min_lon") minLon: Double,
        @Query("max_lat") maxLat: Double,
        @Query("max_lon") maxLon: Double,
        @Query("status") status: String = "open",
        @Query("category") category: String? = null,
        @Query("includeRemote") includeRemote: Boolean? = null,
    ): GigsInBoundsResponse

    /** `GET /api/gigs/:id` — single-gig detail wrapper. */
    @GET("api/gigs/{id}")
    suspend fun detail(
        @Path("id") id: String,
    ): GigDetailResponse

    /** `GET /api/gigs/:gigId/bids` — owner-only. */
    @GET("api/gigs/{gigId}/bids")
    suspend fun bids(
        @Path("gigId") gigId: String,
    ): GigBidsResponse

    /** `GET /api/gigs/:gigId/chat-room` — get-or-create gig chat room. */
    @GET("api/gigs/{gigId}/chat-room")
    suspend fun chatRoom(
        @Path("gigId") gigId: String,
    ): GigChatRoomResponse

    /** `GET /api/gigs/:gigId/questions` — structured Q&A (public). */
    @GET("api/gigs/{gigId}/questions")
    suspend fun questions(
        @Path("gigId") gigId: String,
    ): GigQuestionsResponse

    /** `POST /api/gigs/:gigId/questions` — ask a question. */
    @POST("api/gigs/{gigId}/questions")
    suspend fun askQuestion(
        @Path("gigId") gigId: String,
        @Body body: AskGigQuestionBody,
    ): GigQuestionMutationResponse

    /** `POST /api/gigs/:gigId/questions/{questionId}/answer` — poster answers. */
    @POST("api/gigs/{gigId}/questions/{questionId}/answer")
    suspend fun answerQuestion(
        @Path("gigId") gigId: String,
        @Path("questionId") questionId: String,
        @Body body: AnswerGigQuestionBody,
    ): GigQuestionMutationResponse

    /** `POST /api/gigs/:gigId/bids` — place a bid. */
    @POST("api/gigs/{gigId}/bids")
    suspend fun placeBid(
        @Path("gigId") gigId: String,
        @Body body: PlaceBidBody,
    ): PlaceBidResponse

    /**
     * `POST /api/gigs/:gigId/bids/:bidId/reject` — poster rejects a bid.
     * Route `backend/routes/gigs.js:5026`. Returns `{ message }`.
     */
    @POST("api/gigs/{gigId}/bids/{bidId}/reject")
    suspend fun rejectBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidMutationResponse

    /**
     * `POST /api/gigs/:gigId/bids/:bidId/counter` — poster counters a
     * pending bid (one outstanding counter per bid). Route
     * `backend/routes/gigs.js:5097`. Returns `{ bid }` with
     * `status == "countered"` + `counter_amount`.
     */
    @POST("api/gigs/{gigId}/bids/{bidId}/counter")
    suspend fun counterBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
        @Body body: CounterBidBody,
    ): GigBidMutationResponse

    /**
     * `POST /api/gigs/:gigId/bids/:bidId/counter/accept` — bidder accepts
     * the poster's counter (bid amount becomes the counter amount). Route
     * `backend/routes/gigs.js:5182`. Returns `{ bid }`.
     */
    @POST("api/gigs/{gigId}/bids/{bidId}/counter/accept")
    suspend fun acceptCounterOffer(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidMutationResponse

    /**
     * `POST /api/gigs/:gigId/bids/:bidId/counter/decline` — bidder
     * declines the counter; the original bid stands. Route
     * `backend/routes/gigs.js:5260`. Returns `{ bid }`.
     */
    @POST("api/gigs/{gigId}/bids/{bidId}/counter/decline")
    suspend fun declineCounterOffer(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidMutationResponse

    /**
     * `POST /api/gigs/:gigId/instant-accept` — helper claims an
     * `engagement_mode == "instant_accept"` task while it is still open.
     * Route `backend/routes/gigsV2.js:64` (mounted at `/api/gigs`,
     * `backend/app.js:309`). Paid gigs return the poster-side payment
     * payload alongside the now-`assigned` gig.
     */
    @POST("api/gigs/{gigId}/instant-accept")
    suspend fun instantAccept(
        @Path("gigId") gigId: String,
    ): GigInstantAcceptResponse

    /**
     * `POST /api/gigs/:gigId/worker-ack` — assigned worker acknowledges
     * ("I'm on it") before starting. Route `backend/routes/gigs.js:5838`.
     */
    @POST("api/gigs/{gigId}/worker-ack")
    suspend fun workerAck(
        @Path("gigId") gigId: String,
        @Body body: WorkerAckBody,
    ): WorkerAckResponse

    /**
     * `POST /api/gigs/:gigId/start` — assigned worker transitions
     * `assigned → in_progress` (payment must be authorized for paid
     * gigs). Route `backend/routes/gigs.js:5501`. Returns `{ gig }`.
     */
    @POST("api/gigs/{gigId}/start")
    suspend fun startGig(
        @Path("gigId") gigId: String,
    ): GigDetailResponse

    /**
     * `GET /api/gigs/:gigId/no-show-check` — should the viewer see the
     * "Report no-show" affordance? Route `backend/routes/gigs.js:7720`.
     */
    @GET("api/gigs/{gigId}/no-show-check")
    suspend fun noShowCheck(
        @Path("gigId") gigId: String,
    ): NoShowCheckResponse

    /**
     * `POST /api/gigs/:gigId/report-no-show` — poster/worker reports the
     * other side; cancels the gig with a no-show incident. Route
     * `backend/routes/gigs.js:7572`.
     */
    @POST("api/gigs/{gigId}/report-no-show")
    suspend fun reportNoShow(
        @Path("gigId") gigId: String,
        @Body body: ReportNoShowBody,
    ): ReportNoShowResponse

    /**
     * `POST /api/gigs/:gigId/report` — flag a gig for moderation. Route
     * `backend/routes/gigs.js:3110`; reasons per `reportGigSchema`
     * (`backend/routes/gigs.js:690`).
     */
    @POST("api/gigs/{gigId}/report")
    suspend fun reportGig(
        @Path("gigId") gigId: String,
        @Body body: ReportGigBody,
    ): ReportGigResponse

    /**
     * `GET /api/gigs/:gigId/cancellation-preview` — zone + fee preview
     * shown before the owner confirms a cancel. Route
     * `backend/routes/gigs.js:6354`.
     */
    @GET("api/gigs/{gigId}/cancellation-preview")
    suspend fun cancellationPreview(
        @Path("gigId") gigId: String,
    ): CancellationPreviewResponse

    /**
     * `POST /api/gigs/:gigId/reschedule` — poster moves an assigned gig
     * to a new future start instead of cancelling (the path the
     * preview's `can_reschedule` advertises; poster-only, status
     * `assigned`, zone <= 1). Route `backend/routes/gigs.js:6405`.
     */
    @POST("api/gigs/{gigId}/reschedule")
    suspend fun rescheduleGig(
        @Path("gigId") gigId: String,
        @Body body: RescheduleGigBody,
    ): RescheduleGigResponse

    /**
     * `GET /api/gigs/:gigId/payment` — payment details for the gig's
     * "Payment" card (poster or worker; Stripe ids stripped for the
     * worker). Route `backend/routes/gigs.js:8440`.
     */
    @GET("api/gigs/{gigId}/payment")
    suspend fun gigPayment(
        @Path("gigId") gigId: String,
    ): GigPaymentResponse

    /**
     * `GET /api/gigs/:gigId/change-orders` — list change orders, newest
     * first (poster or worker). Route `backend/routes/gigs.js:6640`.
     */
    @GET("api/gigs/{gigId}/change-orders")
    suspend fun changeOrders(
        @Path("gigId") gigId: String,
    ): GigChangeOrdersResponse

    /**
     * `POST /api/gigs/:gigId/change-orders` — propose a change (either
     * party, gig `assigned` or `in_progress`, ≤5 pending). Route
     * `backend/routes/gigs.js:6691`.
     */
    @POST("api/gigs/{gigId}/change-orders")
    suspend fun createChangeOrder(
        @Path("gigId") gigId: String,
        @Body body: CreateChangeOrderBody,
    ): GigChangeOrderMutationResponse

    /**
     * `POST /api/gigs/:gigId/change-orders/:orderId/approve` — the
     * counterparty approves; price deltas apply to the gig. Route
     * `backend/routes/gigs.js:6828`.
     */
    @POST("api/gigs/{gigId}/change-orders/{orderId}/approve")
    suspend fun approveChangeOrder(
        @Path("gigId") gigId: String,
        @Path("orderId") orderId: String,
    ): GigChangeOrderMutationResponse

    /**
     * `POST /api/gigs/:gigId/change-orders/:orderId/reject` — the
     * counterparty declines with an optional reason. Route
     * `backend/routes/gigs.js:6913`.
     */
    @POST("api/gigs/{gigId}/change-orders/{orderId}/reject")
    suspend fun rejectChangeOrder(
        @Path("gigId") gigId: String,
        @Path("orderId") orderId: String,
        @Body body: RejectChangeOrderBody,
    ): GigChangeOrderMutationResponse

    /**
     * `POST /api/gigs/:gigId/change-orders/:orderId/withdraw` — the
     * requester pulls their own pending order. Route
     * `backend/routes/gigs.js:6994`.
     */
    @POST("api/gigs/{gigId}/change-orders/{orderId}/withdraw")
    suspend fun withdrawChangeOrder(
        @Path("gigId") gigId: String,
        @Path("orderId") orderId: String,
    ): GigChangeOrderMutationResponse

    /** `POST /api/gigs/:gigId/bids/:bidId/accept` — poster accepts a bid. */
    @POST("api/gigs/{gigId}/bids/{bidId}/accept")
    suspend fun acceptBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidAcceptResponse

    /** `POST /api/gigs/:gigId/bids/:bidId/finalize-accept` after PaymentSheet. */
    @POST("api/gigs/{gigId}/bids/{bidId}/finalize-accept")
    suspend fun finalizeAcceptBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidAcceptResponse

    /** `POST /api/gigs/:gigId/bids/:bidId/abort-accept` after cancel/decline. */
    @POST("api/gigs/{gigId}/bids/{bidId}/abort-accept")
    suspend fun abortAcceptBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidAcceptResponse

    /** `POST /api/gigs/:id/save` — bookmark. */
    @POST("api/gigs/{id}/save")
    suspend fun save(
        @Path("id") id: String,
    ): GigSaveResponse

    /** `DELETE /api/gigs/:id/save` — un-bookmark. */
    @DELETE("api/gigs/{id}/save")
    suspend fun unsave(
        @Path("id") id: String,
    ): GigSaveResponse

    /**
     * `POST /api/gigs/:gigId/mark-completed` — assigned worker marks
     * the gig done. Route `backend/routes/gigs.js:5926`. T5.3.1 sends
     * only the optional `note`; the full backend shape also accepts
     * photos + checklist for a future PR.
     */
    @POST("api/gigs/{gigId}/mark-completed")
    suspend fun markCompleted(
        @Path("gigId") gigId: String,
        @Body body: MarkCompletedBody,
    ): MarkCompletedResponse

    /**
     * `GET /api/gigs/my-gigs` — list the caller's posted gigs with
     * inlined `bid_count`, `top_bid_amount`, `top_bidders[≤3]`, and
     * boost timestamps. Route `backend/routes/gigs.js:1169`.
     */
    @GET("api/gigs/my-gigs")
    suspend fun myGigs(
        @Query("limit") limit: Int = 100,
        @Query("status") status: String? = null,
    ): MyGigsResponse

    /**
     * `POST /api/gigs/:gigId/boost` — poster promotes their gig in the
     * feed for 24h. Route added in T5.3.2.
     */
    @POST("api/gigs/{gigId}/boost")
    suspend fun boostGig(
        @Path("gigId") gigId: String,
    ): BoostGigResponse

    /**
     * `POST /api/gigs/:gigId/complete` — poster confirms completion.
     * Alias of `/confirm-completion`. Route `backend/routes/gigs.js:6170`.
     * Distinct from `markCompleted(...)` which is the worker-only
     * `/mark-completed` route.
     */
    @POST("api/gigs/{gigId}/complete")
    suspend fun completeGigAsPoster(
        @Path("gigId") gigId: String,
    ): CompleteGigResponse

    /**
     * `POST /api/gigs/:gigId/cancel` — poster cancels the gig. Route
     * `backend/routes/gigs.js:6233`.
     */
    @POST("api/gigs/{gigId}/cancel")
    suspend fun cancelGig(
        @Path("gigId") gigId: String,
        @Body body: CancelGigBody,
    ): CompleteGigResponse

    /**
     * `POST /api/gigs` — create a new gig. Route
     * `backend/routes/gigs.js:841`. The full schema accepts ~40 fields;
     * the Post-a-Task wizard sends the eight required ones plus a few
     * Magic Task tags.
     */
    @POST("api/gigs")
    suspend fun createGig(
        @Body body: CreateGigBody,
    ): CreateGigResponse

    /**
     * `PATCH /api/gigs/:id` — update a gig. Route
     * `backend/routes/gigs.js:3587`. Owner-only, open gigs only; takes the
     * same body fields as create (the update schema strips the rest) and
     * returns the updated gig in the same `{ gig }` envelope.
     */
    @PATCH("api/gigs/{id}")
    suspend fun updateGig(
        @Path("id") id: String,
        @Body body: CreateGigBody,
    ): CreateGigResponse
}
