@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The public, unauthenticated invitee flow (backend origin `/api/public/…`).
 * `GET /book/:slug`, `…/slots`, `POST /book/:slug/:eventTypeSlug`, one-off
 * `GET/POST /book/o/:token`, manage `GET /booking/:token` + reschedule/cancel/
 * accept/decline, and waitlist join.
 *
 * First-class non-error states ride on `status` (`active|paused|unavailable|
 * expired`). Render `startLocal`, store UTC `start`. Persist the one-time
 * `manageToken`.
 */
@JsonClass(generateAdapter = true)
data class PublicPageView(
    val slug: String? = null,
    val title: String? = null,
    val tagline: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    val intro: String? = null,
    val timezone: String? = null,
    val branding: Map<String, Any?>? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "cancellation_policy") val cancellationPolicy: String? = null,
)

/** The invitee-facing projection of an event type (public reads). */
@JsonClass(generateAdapter = true)
data class PublicEventTypeView(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val description: String? = null,
    val color: String? = null,
    val durations: List<Int> = emptyList(),
    @Json(name = "default_duration") val defaultDuration: Int? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
    @Json(name = "location_detail") val locationDetail: String? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    val currency: String? = null,
    @Json(name = "deposit_cents") val depositCents: Int? = null,
    @Json(name = "deposit_refundable") val depositRefundable: Boolean? = null,
    @Json(name = "refund_policy") val refundPolicy: String? = null,
    @Json(name = "cancellation_window_min") val cancellationWindowMin: Int? = null,
    @Json(name = "reschedule_cutoff_min") val rescheduleCutoffMin: Int? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
)

/** `GET /api/public/book/:slug` — page + status + bookable event types. */
@JsonClass(generateAdapter = true)
data class PublicBookingPageResponse(
    val page: PublicPageView? = null,
    val status: String? = null,
    val eventTypes: List<PublicEventTypeView> = emptyList(),
)

/** `GET /api/public/book/:slug/:eventTypeSlug/slots`. Paused → empty + status. */
@JsonClass(generateAdapter = true)
data class PublicSlotsResponse(
    val eventType: PublicEventTypeView? = null,
    val timezone: String? = null,
    val status: String? = null,
    val slots: List<SlotDto> = emptyList(),
)

/** `GET /api/public/book/o/:token` — one-off link landing. */
@JsonClass(generateAdapter = true)
data class OneOffBookingView(
    val eventType: PublicEventTypeView? = null,
    @Json(name = "single_use") val singleUse: Boolean = false,
    val slots: List<SlotDto> = emptyList(),
)

/** The booking returned by a public create. */
@JsonClass(generateAdapter = true)
data class PublicBookingRef(
    val id: String,
    val status: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
    @Json(name = "policy_snapshot") val policySnapshot: Map<String, Any?>? = null,
)

/** Page confirmation snippet returned on a successful book. */
@JsonClass(generateAdapter = true)
data class PublicConfirmPage(
    @Json(name = "confirmation_message") val confirmationMessage: String? = null,
    val timezone: String? = null,
)

/**
 * `POST /api/public/book/:slug/:eventTypeSlug` (and `…/book/o/:token`) →
 * 201 with the one-time `manageToken` (persist it) and a Stripe `clientSecret`
 * for priced bookings (paid flag + test mode).
 */
@JsonClass(generateAdapter = true)
data class PublicBookingCreatedResponse(
    val booking: PublicBookingRef,
    val eventType: PublicEventTypeView? = null,
    val page: PublicConfirmPage? = null,
    val manageToken: String? = null,
    val clientSecret: String? = null,
)

/** The booking row inside the manage view. */
@JsonClass(generateAdapter = true)
data class ManageBookingDetail(
    val id: String,
    val status: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "invitee_timezone") val inviteeTimezone: String? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
    @Json(name = "location_detail") val locationDetail: String? = null,
    @Json(name = "previous_start_at") val previousStartAt: String? = null,
    @Json(name = "cancel_reason") val cancelReason: String? = null,
    @Json(name = "policy_snapshot") val policySnapshot: Map<String, Any?>? = null,
)

/** What the invitee can do, computed from policy + deadlines. */
@JsonClass(generateAdapter = true)
data class ManageActions(
    @Json(name = "can_cancel") val canCancel: Boolean? = null,
    @Json(name = "can_reschedule") val canReschedule: Boolean? = null,
    @Json(name = "invitee_cancel_allowed") val inviteeCancelAllowed: Boolean? = null,
    @Json(name = "invitee_reschedule_allowed") val inviteeRescheduleAllowed: Boolean? = null,
    @Json(name = "reschedule_deadline") val rescheduleDeadline: String? = null,
    @Json(name = "free_cancel_until") val freeCancelUntil: String? = null,
    @Json(name = "refund_estimate_cents") val refundEstimateCents: Int? = null,
)

/** Payment block on the manage view (null if free). */
@JsonClass(generateAdapter = true)
data class ManagePayment(
    @Json(name = "amount_total") val amountTotal: Int? = null,
    val currency: String? = null,
    @Json(name = "payment_status") val paymentStatus: String? = null,
    @Json(name = "paid_at") val paidAt: String? = null,
)

/** `GET /api/public/booking/:token` — the manage-your-booking view. */
@JsonClass(generateAdapter = true)
data class ManageBookingResponse(
    val booking: ManageBookingDetail,
    val actions: ManageActions? = null,
    val payment: ManagePayment? = null,
    val eventType: PublicEventTypeView? = null,
    val page: PublicPageView? = null,
)

/** `POST /api/public/booking/:token/{reschedule,cancel,accept,decline}` — `{ booking: … }`. */
@JsonClass(generateAdapter = true)
data class PublicBookingMutationResponse(
    val booking: PublicBookingRef,
)

// ─── Request bodies ────────────────────────────────────────────────────────

/** Body for `POST /api/public/book/:slug/:eventTypeSlug` and `…/book/o/:token`. */
@JsonClass(generateAdapter = true)
data class PublicCreateBookingRequest(
    @Json(name = "start_at") val startAt: String,
    val name: String,
    val email: String,
    @Json(name = "duration_min") val durationMin: Int? = null,
    val phone: String? = null,
    val timezone: String? = null,
    val answers: Map<String, Any?>? = null,
)

/** Body for `POST /api/public/booking/:token/reschedule`. */
@JsonClass(generateAdapter = true)
data class PublicRescheduleRequest(
    @Json(name = "start_at") val startAt: String,
)

/** Body for `POST /api/public/booking/:token/cancel`. */
@JsonClass(generateAdapter = true)
data class PublicCancelRequest(
    val reason: String? = null,
)

/** Body for `POST /api/public/book/:slug/:eventTypeSlug/waitlist`. */
@JsonClass(generateAdapter = true)
data class PublicWaitlistJoinRequest(
    val email: String,
    val name: String? = null,
    @Json(name = "desired_from") val desiredFrom: String? = null,
    @Json(name = "desired_to") val desiredTo: String? = null,
)

/** The waitlist row returned by a public join. */
@JsonClass(generateAdapter = true)
data class WaitlistJoinRef(
    val id: String,
    val status: String? = null,
)

/** `POST /api/public/book/:slug/:eventTypeSlug/waitlist` — `{ waitlist: … }`. */
@JsonClass(generateAdapter = true)
data class PublicWaitlistJoinResponse(
    val waitlist: WaitlistJoinRef,
)
