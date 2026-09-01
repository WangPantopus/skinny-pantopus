@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Privacy-safe coarse location surfaced on map / in-bounds responses. */
@JsonClass(generateAdapter = true)
data class GigApproxLocation(
    val latitude: Double? = null,
    val longitude: Double? = null,
    val label: String? = null,
)

/** Creator / poster identity on a gig. Detail responses use the identity
 * serializer (`creator.displayName`, `creator.handle`); list joins may still
 * nest the legacy `User` row (`name`, `username`). */
@JsonClass(generateAdapter = true)
data class GigCreator(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "displayName") val displayName: String? = null,
    val handle: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    @Json(name = "avatarUrl") val avatarUrl: String? = null,
    val verified: Boolean? = null,
    val badges: List<String>? = null,
) {
    fun resolvedDisplayName(): String =
        displayName?.takeIf { it.isNotEmpty() }
            ?: name?.takeIf { it.isNotEmpty() }
            ?: handle?.takeIf { it.isNotEmpty() }
            ?: username?.takeIf { it.isNotEmpty() }
            ?: "Neighbor"

    fun resolvedHandle(): String? = handle?.takeIf { it.isNotEmpty() } ?: username?.takeIf { it.isNotEmpty() }

    fun resolvedVerified(): Boolean = verified == true || badges.orEmpty().contains("verified_resident")

    fun resolvedAvatarUrl(): String? =
        avatarUrl?.takeIf { it.isNotEmpty() }
            ?: profilePictureUrl?.takeIf { it.isNotEmpty() }
}

/**
 * One row from `GET /api/gigs` / `GET /api/gigs/nearby`. Mirrors the
 * GIG_LIST projection from `backend/routes/gigs.js`.
 */
@JsonClass(generateAdapter = true)
data class GigDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val price: Double? = null,
    val category: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val deadline: String? = null,
    @Json(name = "is_urgent") val isUrgent: Boolean? = null,
    val tags: List<String>? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "accepted_by") val acceptedBy: String? = null,
    @Json(name = "accepted_at") val acceptedAt: String? = null,
    // Set the moment the worker starts. Both pre-start release routes
    // (`/reopen-bidding`, `/worker-release`) reject once this is non-null.
    @Json(name = "started_at") val startedAt: String? = null,
    // Set when the poster confirms completion — gates the Block 3D tip affordance.
    @Json(name = "owner_confirmed_at") val ownerConfirmedAt: String? = null,
    @Json(name = "scheduled_start") val scheduledStart: String? = null,
    @Json(name = "payment_status") val paymentStatus: String? = null,
    // Phase 5 — worker acknowledgement ("I'm on it") while `assigned`.
    @Json(name = "worker_ack_status") val workerAckStatus: String? = null,
    // Phase 5b — ETA accompanying a `running_late` acknowledgement.
    @Json(name = "worker_ack_eta_minutes") val workerAckEtaMinutes: Int? = null,
    // Timestamp of the poster's last "Remind worker" nudge. The backend
    // enforces a 15-minute cooldown off this column
    // (`backend/routes/gigs.js:5769`), mirrored on the detail button.
    @Json(name = "last_worker_reminder_at") val lastWorkerReminderAt: String? = null,
    @Json(name = "engagement_mode") val engagementMode: String? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
    @Json(name = "pay_type") val payType: String? = null,
    @Json(name = "task_archetype") val taskArchetype: String? = null,
    // Explicit V2 ("Magic Task") discriminator. `false` → sparse V1 legacy
    // layout; `null`/`true` → rich V2 surface (awarded legacy without the
    // flag still falls back to V1 in projection).
    @Json(name = "is_v2") val isV2: Boolean? = null,
    @Json(name = "pickup_address") val pickupAddress: String? = null,
    @Json(name = "dropoff_address") val dropoffAddress: String? = null,
    /** Owner-visible free-text address on `GET /api/gigs/:id` (A13.8 P4 edit prefill). */
    @Json(name = "exact_address") val exactAddress: String? = null,
    /** Uploaded photo URLs from `GET /api/gigs/:id` — prefill the V1 editor's grid (P4). */
    val attachments: List<String>? = null,
    @Json(name = "bid_count") val bidCount: Int? = null,
    @Json(name = "saved_by_user") val savedByUser: Boolean? = null,
    @Json(name = "distance_miles") val distanceMiles: Double? = null,
    /** Spatial-RPC rows (browse sections, spatial list path) carry meters. */
    @Json(name = "distance_meters") val distanceMeters: Double? = null,
    /** First attachment URL, enriched server-side for thumbnails. */
    @Json(name = "first_image") val firstImage: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "approx_location") val approxLocation: GigApproxLocation? = null,
    /** True when the viewer may see exact coordinates (owner or assigned worker). */
    @Json(name = "locationUnlocked") val locationUnlocked: Boolean? = null,
    /** Privacy-adjusted coordinates from `GET /api/gigs/:id`. */
    val location: GigCoordinate? = null,
    @Json(name = "exact_city") val exactCity: String? = null,
    @Json(name = "exact_state") val exactState: String? = null,
    /** `flexible` / `standard` / `strict` — composer edit prefill (`gigs.js:642`). */
    @Json(name = "cancellation_policy") val cancellationPolicy: String? = null,
    /** Hours, `Joi.number().positive()`. Composer edit prefill. */
    @Json(name = "estimated_duration") val estimatedDuration: Double? = null,
    /** Errand / shopping line items (`Gig.items` jsonb). Composer edit prefill. */
    val items: List<GigItemDto>? = null,
    /**
     * Sibling of [isUrgent] — the backend gates the live fulfillment
     * routes on `is_urgent || starts_asap` (`gigs.js:8703`).
     */
    @Json(name = "starts_asap") val startsAsap: Boolean? = null,
    @Json(name = "creator") val creator: GigCreator? = null,
    @Json(name = "User") val legacyCreator: GigCreator? = null,
) {
    fun posterIdentity(): GigCreator? = creator ?: legacyCreator

    /** The backend's own gate on `/status` + `/active-status`. */
    fun usesLiveFulfillment(): Boolean = isUrgent == true || startsAsap == true
}

/** Nested `{ latitude, longitude }` on gig detail responses. */
@JsonClass(generateAdapter = true)
data class GigCoordinate(
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/**
 * Paging envelope emitted by the **spatial** branch of `GET /api/gigs`
 * (`backend/routes/gigs.js:2388`). Keys are already camelCase on the wire.
 * The non-spatial branch omits it and returns an exact `total` instead
 * (`backend/routes/gigs.js:2588`).
 */
@JsonClass(generateAdapter = true)
data class GigsListPagination(
    val limit: Int? = null,
    val offset: Int? = null,
    val hasMore: Boolean? = null,
)

/** Envelope from `/api/gigs`. */
@JsonClass(generateAdapter = true)
data class GigsListResponse(
    val gigs: List<GigDto>,
    val total: Int? = null,
    val radiusMeters: Int? = null,
    /** Present only on the spatial branch — see [GigsListPagination]. */
    val pagination: GigsListPagination? = null,
) {
    /**
     * Whether another page exists after the one just decoded. Preference
     * order matches what the backend actually sends: the spatial branch's
     * explicit `pagination.hasMore`, then the non-spatial branch's exact
     * `total`, and only then the "did we get a full page" heuristic.
     */
    fun hasMorePages(
        offset: Int,
        limit: Int,
    ): Boolean {
        pagination?.hasMore?.let { return it }
        total?.let { return offset + gigs.size < it }
        return gigs.size >= limit
    }
}

/** Save / unsave envelope from `POST /api/gigs/:id/save`. */
@JsonClass(generateAdapter = true)
data class GigSaveResponse(
    val message: String? = null,
    val saved: Boolean? = null,
)

/** Backend recenter hint for empty map viewports. */
@JsonClass(generateAdapter = true)
data class GigsNearestActivityCenter(
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** Envelope from `GET /api/gigs/in-bounds`. */
@JsonClass(generateAdapter = true)
data class GigsInBoundsResponse(
    val gigs: List<GigDto>,
    @Json(name = "nearest_activity_center") val nearestActivityCenter: GigsNearestActivityCenter? = null,
)

/** Envelope from `GET /api/gigs/:id`. */
@JsonClass(generateAdapter = true)
data class GigDetailResponse(
    val gig: GigDto,
)

/** One bid on a gig. */
@JsonClass(generateAdapter = true)
data class GigBidDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "bid_amount") val bidAmount: Double? = null,
    val amount: Double? = null,
    val status: String? = null,
    val message: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    // Phase 5 — counter-offer fields (`POST .../bids/:bidId/counter`).
    @Json(name = "counter_amount") val counterAmount: Double? = null,
    @Json(name = "counter_status") val counterStatus: String? = null,
    @Json(name = "counter_message") val counterMessage: String? = null,
    @Json(name = "countered_at") val counteredAt: String? = null,
    val bidder: GigCreator? = null,
    @Json(name = "User") val legacyBidder: GigCreator? = null,
) {
    fun bidderIdentity(): GigCreator? = bidder ?: legacyBidder

    /** A counter from the poster is outstanding on this bid. */
    val hasPendingCounter: Boolean get() = counterStatus == "pending" && counterAmount != null
}

/** Envelope from `GET /api/gigs/:gigId/bids`. */
@JsonClass(generateAdapter = true)
data class GigBidsResponse(
    val bids: List<GigBidDto>,
)

/** Envelope from `GET /api/gigs/:gigId/chat-room`. */
@JsonClass(generateAdapter = true)
data class GigChatRoomResponse(
    val roomId: String,
    val topicId: String? = null,
    val gigOwnerId: String? = null,
)

/** User summary nested on a gig question row. */
@JsonClass(generateAdapter = true)
data class GigQuestionUser(
    val id: String? = null,
    val username: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** One row from `GET /api/gigs/:gigId/questions`. */
@JsonClass(generateAdapter = true)
data class GigQuestionDto(
    val id: String,
    @Json(name = "gig_id") val gigId: String,
    val question: String,
    val answer: String? = null,
    @Json(name = "question_attachments") val questionAttachments: List<String>? = null,
    @Json(name = "answer_attachments") val answerAttachments: List<String>? = null,
    @Json(name = "answered_at") val answeredAt: String? = null,
    @Json(name = "is_pinned") val isPinned: Boolean? = null,
    @Json(name = "upvote_count") val upvoteCount: Int? = null,
    val status: String,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val asker: GigQuestionUser? = null,
    val answerer: GigQuestionUser? = null,
    @Json(name = "answerer_display_name") val answererDisplayName: String? = null,
) {
    val isAnswered: Boolean get() = status == "answered"
}

/** Envelope from `GET /api/gigs/:gigId/questions`. */
@JsonClass(generateAdapter = true)
data class GigQuestionsResponse(
    val questions: List<GigQuestionDto>,
)

/** Envelope from ask/answer mutations. */
@JsonClass(generateAdapter = true)
data class GigQuestionMutationResponse(
    val question: GigQuestionDto,
)

/** Body for `POST /api/gigs/:gigId/questions`. */
@JsonClass(generateAdapter = true)
data class AskGigQuestionBody(
    val question: String,
    val attachments: List<String>? = null,
)

/** Body for `POST /api/gigs/:gigId/questions/:questionId/answer`. */
@JsonClass(generateAdapter = true)
data class AnswerGigQuestionBody(
    val answer: String,
    val attachments: List<String>? = null,
)

/** `POST /api/gigs/:gigId/bids` body. */
@JsonClass(generateAdapter = true)
data class PlaceBidBody(
    @Json(name = "bid_amount") val bidAmount: Double,
    val message: String? = null,
    @Json(name = "proposed_time") val proposedTime: String? = null,
)

/** `POST /api/gigs/:gigId/bids` envelope. */
@JsonClass(generateAdapter = true)
data class PlaceBidResponse(
    val bid: GigBidDto? = null,
    val message: String? = null,
)

/**
 * Response from `POST /api/gigs/:gigId/bids/:bidId/accept`.
 * Paid gigs return PaymentSheet params and stay in `pending_payment`
 * until `finalize-accept` succeeds; free gigs may already be accepted.
 */
@JsonClass(generateAdapter = true)
data class GigBidAcceptResponse(
    val bid: GigBidDto? = null,
    val message: String? = null,
    val requiresPaymentSetup: Boolean? = null,
    val isSetupIntent: Boolean? = null,
    val payment: PaymentPayload? = null,
    val publishableKey: String? = null,
    val clientSecret: String? = null,
    val paymentId: String? = null,
    val setupIntentId: String? = null,
    val paymentIntentId: String? = null,
    val ephemeralKey: String? = null,
    val customer: String? = null,
    val customerId: String? = null,
) {
    fun sheetParams(): PaymentIntentSheetParamsDto =
        PaymentIntentSheetParamsDto(
            clientSecret = clientSecret ?: payment?.clientSecret,
            paymentIntentId = paymentIntentId ?: payment?.paymentIntentId,
            customer = customer ?: customerId,
            ephemeralKey = ephemeralKey,
            publishableKey = publishableKey,
            isSetupIntent = isSetupIntent,
        )

    @JsonClass(generateAdapter = true)
    data class PaymentPayload(
        val clientSecret: String? = null,
        val paymentId: String? = null,
        val setupIntentId: String? = null,
        val paymentIntentId: String? = null,
    )
}

/**
 * Body for `POST /api/gigs/:gigId/mark-completed`. The Delivery Proof
 * sheet sends the optional `note` plus `photos` (proof-of-delivery URLs
 * uploaded first via `POST /api/files/upload`); the backend stores them
 * as `completion_photos`. `checklist` is omitted.
 */
@JsonClass(generateAdapter = true)
data class MarkCompletedBody(
    val note: String? = null,
    val photos: List<String>? = null,
)

/** Response envelope from the mark-completed endpoint. */
@JsonClass(generateAdapter = true)
data class MarkCompletedResponse(
    val message: String? = null,
)

/**
 * Body for `POST /api/gigs`. Mirrors the subset of the backend's
 * `createGigSchema` the Post-a-Task wizard surfaces
 * (`backend/routes/gigs.js:425`). Optional fields are nullable so Moshi
 * omits them from the JSON when unset.
 */
@JsonClass(generateAdapter = true)
data class CreateGigBody(
    val title: String,
    val description: String,
    val category: String? = null,
    val price: Double,
    @Json(name = "pay_type") val payType: String? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
    @Json(name = "scheduled_start") val scheduledStart: String? = null,
    @Json(name = "task_format") val taskFormat: String? = null,
    val attachments: List<String>? = null,
    // E.1 — composer picker-sheet fields. Optional, so Moshi omits them
    // from the JSON when unset.
    val deadline: String? = null,
    @Json(name = "cancellation_policy") val cancellationPolicy: String? = null,
    @Json(name = "is_urgent") val isUrgent: Boolean? = null,
    val tags: List<String>? = null,
    /** Hours (`Joi.number().positive()`, `gigs.js:433`). */
    @Json(name = "estimated_duration") val estimatedDuration: Double? = null,
    /** Errand / shopping line items (`gigs.js:487`). */
    val items: List<GigItemDto>? = null,
    val location: CreateGigLocation,
)

/**
 * Nested `location` object the backend requires
 * (`backend/routes/gigs.js:521`).
 */
@JsonClass(generateAdapter = true)
data class CreateGigLocation(
    val mode: String,
    val latitude: Double,
    val longitude: Double,
    val address: String,
    val city: String? = null,
    val state: String? = null,
    val zip: String? = null,
    val homeId: String? = null,
)

/** Envelope from `POST /api/gigs`. */
@JsonClass(generateAdapter = true)
data class CreateGigResponse(
    val gig: GigDto,
    val message: String? = null,
)
