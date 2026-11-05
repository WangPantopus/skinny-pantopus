package app.pantopus.android.data.api.models.crewday

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Crew Day: the wire shapes of `/api/crew-days` (docs/product/crew-day-build/02-contract.md, section 4).
 *
 * Money is in cents, dates are `YYYY-MM-DD` in the Crew Day's own time zone, times of day are `HH:MM[:SS]` and
 * instants stay ISO-8601 strings (`CrewDayFormat` reads them). Every field the server may leave out has a default, so
 * a read that grows a field, or drops one a screen doesn't need, still decodes.
 */

// MARK: - The street day

/** One price on the crew's list: "Two stories · $180", or a look-first option with no price yet. */
@JsonClass(generateAdapter = true)
data class CrewDayPriceOptionDto(
    @Json(name = "id") val id: String,
    @Json(name = "label") val label: String = "",
    /** Null while the crew confirms the price after a look ([needsLook]). */
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "needs_look") val needsLook: Boolean = false,
)

/** An add-on: "Clean the gutter guards · +$30". */
@JsonClass(generateAdapter = true)
data class CrewDayAddOnDto(
    @Json(name = "id") val id: String,
    @Json(name = "label") val label: String = "",
    @Json(name = "price_cents") val priceCents: Int = 0,
)

@JsonClass(generateAdapter = true)
data class CrewDayRatingDto(
    @Json(name = "average") val average: Double? = null,
    @Json(name = "count") val count: Int = 0,
)

/** The crew row: the business page's name, "Insured and registered" when verified, and its reviews. */
@JsonClass(generateAdapter = true)
data class CrewDayCrewDto(
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "username") val username: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "verified") val verified: Boolean = false,
    @Json(name = "rating") val rating: CrewDayRatingDto? = null,
)

/** Who is reading the invitation: `crew`, `household` (with a booking) or `none`. */
@JsonClass(generateAdapter = true)
data class CrewDayViewerDto(
    @Json(name = "role") val role: String? = null,
    @Json(name = "booking_id") val bookingId: String? = null,
)

/**
 * `GET /api/crew-days/public/:code`: the invitation (screen 1). Counts only, never addresses, households or the
 * area's coordinates. [availability] is `open`, `full`, `closed`, `cancelled` or `done`.
 */
@JsonClass(generateAdapter = true)
data class CrewDayPublicDto(
    @Json(name = "id") val id: String,
    @Json(name = "code") val code: String? = null,
    @Json(name = "title") val title: String = "",
    @Json(name = "service") val service: String? = null,
    @Json(name = "service_label") val serviceLabel: String? = null,
    @Json(name = "street_label") val streetLabel: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "window_starts_at") val windowStartsAt: String? = null,
    @Json(name = "window_ends_at") val windowEndsAt: String? = null,
    @Json(name = "booking_closes_at") val bookingClosesAt: String? = null,
    @Json(name = "included") val included: List<String> = emptyList(),
    @Json(name = "outside_only") val outsideOnly: Boolean = true,
    @Json(name = "prep_note") val prepNote: String? = null,
    @Json(name = "price_from_cents") val priceFromCents: Int? = null,
    @Json(name = "price_options") val priceOptions: List<CrewDayPriceOptionDto> = emptyList(),
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto> = emptyList(),
    @Json(name = "capacity") val capacity: Int = 0,
    @Json(name = "booked_count") val bookedCount: Int = 0,
    @Json(name = "spots_left") val spotsLeft: Int = 0,
    @Json(name = "availability") val availability: String? = null,
    @Json(name = "crew") val crew: CrewDayCrewDto? = null,
    @Json(name = "viewer") val viewer: CrewDayViewerDto? = null,
)

// MARK: - Price and booking (screens 2 to 4)

@JsonClass(generateAdapter = true)
data class CrewDayQuoteBody(
    @Json(name = "latitude") val latitude: Double?,
    @Json(name = "longitude") val longitude: Double?,
    @Json(name = "address_line") val addressLine: String?,
    @Json(name = "option_id") val optionId: String?,
    @Json(name = "add_on_ids") val addOnIds: List<String> = emptyList(),
)

/** `POST /public/:code/quote`: the home's price, or why the day doesn't reach it ([message]). */
@JsonClass(generateAdapter = true)
data class CrewDayQuoteDto(
    @Json(name = "in_area") val inArea: Boolean = false,
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "needs_look") val needsLook: Boolean = false,
    @Json(name = "message") val message: String? = null,
)

@JsonClass(generateAdapter = true)
data class CrewDayAddressDto(
    @Json(name = "line") val line: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "zip") val zip: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
)

/** `POST /api/crew-days/:id/bookings`. A retry with the same [clientRequestId] answers with the same booking. */
@JsonClass(generateAdapter = true)
data class CrewDayBookingBody(
    @Json(name = "client_request_id") val clientRequestId: String,
    @Json(name = "home_id") val homeId: String?,
    @Json(name = "address") val address: CrewDayAddressDto,
    @Json(name = "option_id") val optionId: String,
    @Json(name = "add_on_ids") val addOnIds: List<String>,
    @Json(name = "access_note") val accessNote: String?,
    @Json(name = "payment_method_id") val paymentMethodId: String,
    @Json(name = "approve_terms") val approveTerms: Boolean = true,
)

/** The saved card a booking charges: "Visa ending 4242". */
@JsonClass(generateAdapter = true)
data class CrewDaySavedCardDto(
    @Json(name = "brand") val brand: String? = null,
    @Json(name = "last4") val last4: String? = null,
)

/** `charge`: when and how much, and `scheduled`, `charged`, `paused`, `failed`, `refunded` or `none`. */
@JsonClass(generateAdapter = true)
data class CrewDayChargeDto(
    @Json(name = "due_at") val dueAt: String? = null,
    @Json(name = "amount_cents") val amountCents: Int? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "charged_at") val chargedAt: String? = null,
    @Json(name = "refunded_cents") val refundedCents: Int? = null,
)

/** "On the way · expected 10–11 AM", updated by the crew at [updatedAt]. */
@JsonClass(generateAdapter = true)
data class CrewDayEtaDto(
    @Json(name = "start") val start: String? = null,
    @Json(name = "end") val end: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** One step of the status line (Booked · On the way · Done · Paid): [state] is `done`, `current` or `todo`. */
@JsonClass(generateAdapter = true)
data class CrewDayStepDto(
    @Json(name = "key") val key: String,
    @Json(name = "label") val label: String? = null,
    @Json(name = "state") val state: String? = null,
)

/** A completion or problem photo: a short-lived signed URL. */
@JsonClass(generateAdapter = true)
data class CrewDayPhotoDto(
    @Json(name = "path") val path: String? = null,
    @Json(name = "url") val url: String? = null,
)

/** The household's problem case (screen 7): `open` or `resolved`, and how it ended. */
@JsonClass(generateAdapter = true)
data class CrewDayProblemDto(
    @Json(name = "status") val status: String? = null,
    @Json(name = "kind") val kind: String? = null,
    @Json(name = "note") val note: String? = null,
    @Json(name = "photos") val photos: List<CrewDayPhotoDto> = emptyList(),
    @Json(name = "opened_at") val openedAt: String? = null,
    @Json(name = "due_at") val dueAt: String? = null,
    @Json(name = "resolved_at") val resolvedAt: String? = null,
    @Json(name = "resolution") val resolution: String? = null,
    @Json(name = "refunded_cents") val refundedCents: Int? = null,
)

/** One date of a rain proposal, with its arrival window. */
@JsonClass(generateAdapter = true)
data class CrewDayProposedDateDto(
    @Json(name = "date") val date: String,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
)

/** The open rain proposal (screen 6): two or three dates, and the deadline to answer. */
@JsonClass(generateAdapter = true)
data class CrewDayProposalDto(
    @Json(name = "id") val id: String,
    @Json(name = "dates") val dates: List<CrewDayProposedDateDto> = emptyList(),
    @Json(name = "deadline_at") val deadlineAt: String? = null,
    @Json(name = "note") val note: String? = null,
    @Json(name = "sent_at") val sentAt: String? = null,
)

/** The share kit (screen 12): counts only, and the drafted message. The crew's reads carry [code] and [flyerUrl]. */
@JsonClass(generateAdapter = true)
data class CrewDayShareDto(
    @Json(name = "code") val code: String? = null,
    @Json(name = "url") val url: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "booked_count") val bookedCount: Int = 0,
    @Json(name = "spots_left") val spotsLeft: Int = 0,
    @Json(name = "flyer_url") val flyerUrl: String? = null,
)

/** A timeline line: what happened, who did it, when (`CrewDayEvent`). */
@JsonClass(generateAdapter = true)
data class CrewDayEventDto(
    @Json(name = "id") val id: String,
    @Json(name = "kind") val kind: String,
    @Json(name = "actor_role") val actorRole: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "text") val text: String? = null,
)

/** The day as a booking page shows it: title, date and window, the crew, its prep note and included items. */
@JsonClass(generateAdapter = true)
data class CrewDaySummaryDto(
    @Json(name = "id") val id: String,
    @Json(name = "code") val code: String? = null,
    @Json(name = "title") val title: String = "",
    @Json(name = "service") val service: String? = null,
    @Json(name = "street_label") val streetLabel: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "window_starts_at") val windowStartsAt: String? = null,
    @Json(name = "booking_closes_at") val bookingClosesAt: String? = null,
    @Json(name = "included") val included: List<String> = emptyList(),
    @Json(name = "outside_only") val outsideOnly: Boolean = true,
    @Json(name = "prep_note") val prepNote: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "crew") val crew: CrewDayCrewDto? = null,
)

/**
 * A household's booking (screen 5, `GET /api/crew-days/bookings/:bookingId`). [status] is the booking's status
 * (`price_pending`, `price_offered`, `booked`, `new_dates`, `on_the_way`, `done`, `paid`, `payment_failed`,
 * `refunded`, `cancelled`, `declined`).
 */
@JsonClass(generateAdapter = true)
data class CrewDayBookingDto(
    @Json(name = "id") val id: String,
    @Json(name = "crew_day_id") val crewDayId: String? = null,
    @Json(name = "status") val status: String = "",
    @Json(name = "day") val day: CrewDaySummaryDto? = null,
    @Json(name = "steps") val steps: List<CrewDayStepDto> = emptyList(),
    @Json(name = "eta") val eta: CrewDayEtaDto? = null,
    @Json(name = "prep_note") val prepNote: String? = null,
    @Json(name = "access_note") val accessNote: String? = null,
    @Json(name = "address") val address: CrewDayAddressDto? = null,
    @Json(name = "option_id") val optionId: String? = null,
    @Json(name = "option") val option: CrewDayPriceOptionDto? = null,
    @Json(name = "add_on_ids") val addOnIds: List<String> = emptyList(),
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto> = emptyList(),
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "card") val card: CrewDaySavedCardDto? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "cancel_cutoff_at") val cancelCutoffAt: String? = null,
    @Json(name = "can_cancel") val canCancel: Boolean = false,
    @Json(name = "can_change") val canChange: Boolean = false,
    @Json(name = "gate_ready_at") val gateReadyAt: String? = null,
    @Json(name = "done_at") val doneAt: String? = null,
    @Json(name = "done_note") val doneNote: String? = null,
    @Json(name = "photos") val photos: List<CrewDayPhotoDto> = emptyList(),
    @Json(name = "charge") val charge: CrewDayChargeDto? = null,
    @Json(name = "invoice_id") val invoiceId: String? = null,
    @Json(name = "problem") val problem: CrewDayProblemDto? = null,
    @Json(name = "proposal") val proposal: CrewDayProposalDto? = null,
    @Json(name = "remind_next_season") val remindNextSeason: Boolean = false,
    @Json(name = "cancelled_by") val cancelledBy: String? = null,
    @Json(name = "cancelled_at") val cancelledAt: String? = null,
    @Json(name = "share") val share: CrewDayShareDto? = null,
    @Json(name = "events") val events: List<CrewDayEventDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class CrewDayBookingResponse(
    @Json(name = "booking") val booking: CrewDayBookingDto,
)

/** `PATCH /api/crew-days/bookings/:bookingId`: only the fields being changed. */
@JsonClass(generateAdapter = true)
data class CrewDayBookingPatch(
    @Json(name = "access_note") val accessNote: String? = null,
    @Json(name = "option_id") val optionId: String? = null,
    @Json(name = "add_on_ids") val addOnIds: List<String>? = null,
    @Json(name = "remind_next_season") val remindNextSeason: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class CrewDayPriceAnswerBody(
    @Json(name = "approve") val approve: Boolean,
)

@JsonClass(generateAdapter = true)
data class CrewDayProblemBody(
    @Json(name = "kind") val kind: String?,
    @Json(name = "note") val note: String?,
    @Json(name = "photo_paths") val photoPaths: List<String> = emptyList(),
)

/** `choice` is a proposed `YYYY-MM-DD` date or `cancel`. */
@JsonClass(generateAdapter = true)
data class CrewDayNewDateBody(
    @Json(name = "proposal_id") val proposalId: String,
    @Json(name = "choice") val choice: String,
)

@JsonClass(generateAdapter = true)
data class CrewDayUploadResponse(
    @Json(name = "path") val path: String,
    @Json(name = "url") val url: String? = null,
)

@JsonClass(generateAdapter = true)
data class CrewDayRequestBody(
    @Json(name = "service") val service: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "months") val months: List<String>,
    @Json(name = "note") val note: String?,
)

// MARK: - Cards (Today, Your Crew Days)

/**
 * One card on Today (screen 9) or Your Crew Days (screen 10): a booking ([bookingId]), an open day near one of the
 * person's homes, or a street request ([kind] `request`). [status] is the booking's or the request's status.
 */
@JsonClass(generateAdapter = true)
data class CrewDayCardDto(
    @Json(name = "id") val id: String,
    @Json(name = "kind") val kind: String? = null,
    @Json(name = "crew_day_id") val crewDayId: String? = null,
    @Json(name = "booking_id") val bookingId: String? = null,
    @Json(name = "code") val code: String? = null,
    @Json(name = "title") val title: String = "",
    @Json(name = "service") val service: String? = null,
    @Json(name = "street_label") val streetLabel: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "price_from_cents") val priceFromCents: Int? = null,
    @Json(name = "photo_count") val photoCount: Int = 0,
    @Json(name = "eta") val eta: CrewDayEtaDto? = null,
    @Json(name = "gate_ready_at") val gateReadyAt: String? = null,
    @Json(name = "charge") val charge: CrewDayChargeDto? = null,
    @Json(name = "crew") val crew: CrewDayCrewDto? = null,
    @Json(name = "request_months") val requestMonths: List<String> = emptyList(),
    /** A new day this crew opened nearby: "Book again" opens its invitation. */
    @Json(name = "book_again_code") val bookAgainCode: String? = null,
)

/** `GET /api/crew-days/mine` (screen 10). */
@JsonClass(generateAdapter = true)
data class MyCrewDaysResponse(
    @Json(name = "upcoming") val upcoming: List<CrewDayCardDto> = emptyList(),
    @Json(name = "requests") val requests: List<CrewDayCardDto> = emptyList(),
    @Json(name = "past") val past: List<CrewDayCardDto> = emptyList(),
)

/** `GET /api/crew-days/today` (screen 9): the person's bookings, and at most one open day on their street. */
@JsonClass(generateAdapter = true)
data class CrewDayTodayResponse(
    @Json(name = "mine") val mine: List<CrewDayCardDto> = emptyList(),
    @Json(name = "nearby") val nearby: List<CrewDayCardDto> = emptyList(),
)

// MARK: - Crew

/** What the business still needs before it can start a street day: `missing` lists `publish_page`, `set_up_payouts`. */
@JsonClass(generateAdapter = true)
data class CrewDayReadinessDto(
    @Json(name = "published") val published: Boolean = false,
    @Json(name = "payouts_enabled") val payoutsEnabled: Boolean = false,
    @Json(name = "documents_verified") val documentsVerified: Boolean = false,
    @Json(name = "missing") val missing: List<String> = emptyList(),
)

/** A street day in the crew's lists (screen 13, the contract's "day card"), with its counts and charge totals. */
@JsonClass(generateAdapter = true)
data class CrewDayListItemDto(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String = "",
    @Json(name = "service") val service: String? = null,
    @Json(name = "service_label") val serviceLabel: String? = null,
    @Json(name = "street_label") val streetLabel: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "window_starts_at") val windowStartsAt: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "capacity") val capacity: Int = 0,
    @Json(name = "booked_count") val bookedCount: Int = 0,
    @Json(name = "spots_left") val spotsLeft: Int = 0,
    @Json(name = "is_full") val isFull: Boolean = false,
    @Json(name = "booking_closes_at") val bookingClosesAt: String? = null,
    @Json(name = "is_closed") val isClosed: Boolean = false,
    @Json(name = "price_checks") val priceChecks: Int = 0,
    @Json(name = "release_asks") val releaseAsks: Int = 0,
    @Json(name = "done_count") val doneCount: Int = 0,
    @Json(name = "charged_cents") val chargedCents: Int = 0,
    /** The dates its active bookings are on (rain can split a day), or its own date. */
    @Json(name = "dates") val dates: List<String> = emptyList(),
    @Json(name = "review_note") val reviewNote: String? = null,
    @Json(name = "submitted_at") val submittedAt: String? = null,
    @Json(name = "share") val share: CrewDayShareDto? = null,
    @Json(name = "paid_out") val paidOut: Boolean = false,
)

/** The business's fee on each charge: "10% (founding business)". */
@JsonClass(generateAdapter = true)
data class CrewDayFeeDto(
    @Json(name = "rate_pct") val ratePct: Double? = null,
    @Json(name = "founding") val founding: Boolean = false,
)

/** A service the crew can pick, with the day's title word and the included items it starts with. */
@JsonClass(generateAdapter = true)
data class CrewDayServiceDto(
    @Json(name = "key") val key: String,
    @Json(name = "label") val label: String = "",
    @Json(name = "day_title") val dayTitle: String? = null,
    @Json(name = "included") val included: List<String> = emptyList(),
)

/** `GET /api/crew-days/business/:businessId` (screen 13). [canEdit]: owners and editors set up and change days. */
@JsonClass(generateAdapter = true)
data class CrewDayBusinessResponse(
    @Json(name = "readiness") val readiness: CrewDayReadinessDto = CrewDayReadinessDto(),
    @Json(name = "can_edit") val canEdit: Boolean = false,
    @Json(name = "fee") val fee: CrewDayFeeDto? = null,
    @Json(name = "services") val services: List<CrewDayServiceDto> = emptyList(),
    @Json(name = "today") val today: List<CrewDayListItemDto> = emptyList(),
    @Json(name = "upcoming") val upcoming: List<CrewDayListItemDto> = emptyList(),
    @Json(name = "pending") val pending: List<CrewDayListItemDto> = emptyList(),
    @Json(name = "drafts") val drafts: List<CrewDayListItemDto> = emptyList(),
    @Json(name = "past") val past: List<CrewDayListItemDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class CrewDayCenterDto(
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
)

/** `POST /api/crew-days` (screen 14): [submit] sends it to Pantopus for approval, else it stays a draft. */
@JsonClass(generateAdapter = true)
data class CrewDayCreateBody(
    @Json(name = "business_id") val businessId: String,
    @Json(name = "service") val service: String,
    @Json(name = "street_label") val streetLabel: String,
    @Json(name = "city") val city: String?,
    @Json(name = "state") val state: String?,
    @Json(name = "center") val center: CrewDayCenterDto,
    @Json(name = "radius_m") val radiusM: Int,
    @Json(name = "service_date") val serviceDate: String,
    @Json(name = "window_start") val windowStart: String,
    @Json(name = "window_end") val windowEnd: String,
    @Json(name = "capacity") val capacity: Int,
    @Json(name = "booking_closes_at") val bookingClosesAt: String?,
    @Json(name = "included") val included: List<String>,
    @Json(name = "outside_only") val outsideOnly: Boolean,
    @Json(name = "prep_note") val prepNote: String?,
    @Json(name = "price_options") val priceOptions: List<CrewDayPriceOptionDto>,
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto>,
    @Json(name = "submit") val submit: Boolean,
    @Json(name = "repeat_of") val repeatOf: String? = null,
)

/** `PATCH /api/crew-days/:id`: capacity, included items, the prep note and future prices. */
@JsonClass(generateAdapter = true)
data class CrewDayEditBody(
    @Json(name = "capacity") val capacity: Int? = null,
    @Json(name = "included") val included: List<String>? = null,
    @Json(name = "prep_note") val prepNote: String? = null,
    @Json(name = "price_options") val priceOptions: List<CrewDayPriceOptionDto>? = null,
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto>? = null,
)

/** The crew's view of a street day it created (the full row, as `POST /api/crew-days` answers). */
@JsonClass(generateAdapter = true)
data class CrewDayDto(
    @Json(name = "id") val id: String,
    @Json(name = "kind") val kind: String? = null,
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "service") val service: String? = null,
    @Json(name = "title") val title: String = "",
    @Json(name = "street_label") val streetLabel: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "capacity") val capacity: Int = 0,
    @Json(name = "booking_closes_at") val bookingClosesAt: String? = null,
    @Json(name = "included") val included: List<String> = emptyList(),
    @Json(name = "outside_only") val outsideOnly: Boolean = true,
    @Json(name = "prep_note") val prepNote: String? = null,
    @Json(name = "price_options") val priceOptions: List<CrewDayPriceOptionDto> = emptyList(),
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto> = emptyList(),
    @Json(name = "share") val share: CrewDayShareDto? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "review_note") val reviewNote: String? = null,
    @Json(name = "radius_m") val radiusM: Int? = null,
)

@JsonClass(generateAdapter = true)
data class CrewDayResponse(
    @Json(name = "crew_day") val crewDay: CrewDayDto,
)

/** `money` on the crew's day: what all booked homes would bring, and what has been charged, scheduled or paused. */
@JsonClass(generateAdapter = true)
data class CrewDayMoneyDto(
    @Json(name = "gross_cents") val grossCents: Int = 0,
    @Json(name = "fee_rate") val feeRate: Double? = null,
    @Json(name = "net_cents") val netCents: Int = 0,
    @Json(name = "charged_cents") val chargedCents: Int = 0,
    @Json(name = "scheduled_cents") val scheduledCents: Int = 0,
    @Json(name = "paused_cents") val pausedCents: Int = 0,
    @Json(name = "charged_count") val chargedCount: Int = 0,
    @Json(name = "scheduled_count") val scheduledCount: Int = 0,
    @Json(name = "paused_count") val pausedCount: Int = 0,
    @Json(name = "next_charge_at") val nextChargeAt: String? = null,
)

/**
 * A home on the crew's day or route. Before the job window it is [label] ("Home 3") and its details; from 6 PM the
 * evening before (or at once for a price check) it also has the [address], the household's [firstName] and the
 * [accessNote].
 */
@JsonClass(generateAdapter = true)
data class CrewDayHomeDto(
    @Json(name = "id") val id: String,
    @Json(name = "label") val label: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "route_position") val routePosition: Int? = null,
    @Json(name = "address") val address: CrewDayAddressDto? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "access_note") val accessNote: String? = null,
    @Json(name = "option") val option: CrewDayPriceOptionDto? = null,
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto> = emptyList(),
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "eta") val eta: CrewDayEtaDto? = null,
    @Json(name = "gate_ready_at") val gateReadyAt: String? = null,
    @Json(name = "done_at") val doneAt: String? = null,
    @Json(name = "done_note") val doneNote: String? = null,
    @Json(name = "photos") val photos: List<CrewDayPhotoDto> = emptyList(),
    @Json(name = "problem_status") val problemStatus: String? = null,
    @Json(name = "charge") val charge: CrewDayChargeDto? = null,
    @Json(name = "new_date_choice") val newDateChoice: String? = null,
    @Json(name = "asked_at") val askedAt: String? = null,
    @Json(name = "release_asked_at") val releaseAskedAt: String? = null,
    @Json(name = "cant_get_in_at") val cantGetInAt: String? = null,
    @Json(name = "household_user_id") val householdUserId: String? = null,
)

/** What waits on the crew (screen 15): price checks and release requests. */
@JsonClass(generateAdapter = true)
data class CrewDayNeedsYouDto(
    @Json(name = "price_checks") val priceChecks: List<CrewDayHomeDto> = emptyList(),
    @Json(name = "release_asks") val releaseAsks: List<CrewDayHomeDto> = emptyList(),
)

/**
 * `GET /api/crew-days/:id/crew` (screens 15 and 19): the day card, its whole form, what the viewer may change, and
 * (from SRV-3/4) the money, what needs the crew, the homes and the timeline.
 */
@JsonClass(generateAdapter = true)
data class CrewDayCrewViewDto(
    @Json(name = "id") val id: String,
    @Json(name = "kind") val kind: String? = null,
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "title") val title: String = "",
    @Json(name = "service") val service: String? = null,
    @Json(name = "service_label") val serviceLabel: String? = null,
    @Json(name = "street_label") val streetLabel: String? = null,
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
    @Json(name = "service_date") val serviceDate: String? = null,
    @Json(name = "window_start") val windowStart: String? = null,
    @Json(name = "window_end") val windowEnd: String? = null,
    @Json(name = "window_starts_at") val windowStartsAt: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "capacity") val capacity: Int = 0,
    @Json(name = "booked_count") val bookedCount: Int = 0,
    @Json(name = "spots_left") val spotsLeft: Int = 0,
    @Json(name = "is_full") val isFull: Boolean = false,
    @Json(name = "booking_closes_at") val bookingClosesAt: String? = null,
    @Json(name = "is_closed") val isClosed: Boolean = false,
    @Json(name = "price_checks") val priceChecks: Int = 0,
    @Json(name = "release_asks") val releaseAsks: Int = 0,
    @Json(name = "done_count") val doneCount: Int = 0,
    @Json(name = "charged_cents") val chargedCents: Int = 0,
    @Json(name = "dates") val dates: List<String> = emptyList(),
    @Json(name = "share") val share: CrewDayShareDto? = null,
    @Json(name = "center") val center: CrewDayCenterDto? = null,
    @Json(name = "radius_m") val radiusM: Int? = null,
    @Json(name = "cancel_cutoff_at") val cancelCutoffAt: String? = null,
    @Json(name = "included") val included: List<String> = emptyList(),
    @Json(name = "outside_only") val outsideOnly: Boolean = true,
    @Json(name = "prep_note") val prepNote: String? = null,
    @Json(name = "price_options") val priceOptions: List<CrewDayPriceOptionDto> = emptyList(),
    @Json(name = "add_ons") val addOns: List<CrewDayAddOnDto> = emptyList(),
    @Json(name = "price_from_cents") val priceFromCents: Int? = null,
    @Json(name = "proposed_dates") val proposal: CrewDayProposalDto? = null,
    @Json(name = "repeat_of") val repeatOf: String? = null,
    @Json(name = "review_note") val reviewNote: String? = null,
    @Json(name = "cancel_reason") val cancelReason: String? = null,
    @Json(name = "cancelled_by") val cancelledBy: String? = null,
    @Json(name = "can_edit") val canEdit: Boolean = false,
    @Json(name = "editable_fields") val editableFields: List<String> = emptyList(),
    @Json(name = "money") val money: CrewDayMoneyDto = CrewDayMoneyDto(),
    @Json(name = "needs_you") val needsYou: CrewDayNeedsYouDto = CrewDayNeedsYouDto(),
    @Json(name = "bookings") val bookings: List<CrewDayHomeDto> = emptyList(),
    @Json(name = "past_customers") val pastCustomers: Int = 0,
    @Json(name = "events") val events: List<CrewDayEventDto> = emptyList(),
)

/** `GET /api/crew-days/:id/route?date=` (screen 16): the homes for one date, in the crew's order. */
@JsonClass(generateAdapter = true)
data class CrewDayRouteDto(
    @Json(name = "day") val day: CrewDayDto? = null,
    @Json(name = "date") val date: String? = null,
    @Json(name = "homes") val homes: List<CrewDayHomeDto> = emptyList(),
    @Json(name = "done_count") val doneCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class CrewDayPriceBody(
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "decline") val decline: Boolean? = null,
    @Json(name = "note") val note: String? = null,
)

@JsonClass(generateAdapter = true)
data class CrewDayInvitePastResponse(
    @Json(name = "invited") val invited: Int = 0,
)

@JsonClass(generateAdapter = true)
data class CrewDayProposeDatesBody(
    @Json(name = "dates") val dates: List<CrewDayProposedDateDto>,
    @Json(name = "note") val note: String?,
)

@JsonClass(generateAdapter = true)
data class CrewDayReasonBody(
    @Json(name = "reason") val reason: String?,
)

@JsonClass(generateAdapter = true)
data class CrewDayRouteOrderBody(
    @Json(name = "booking_ids") val bookingIds: List<String>,
)

/** `POST …/on-the-way`: the one-hour window the household is told. */
@JsonClass(generateAdapter = true)
data class CrewDayOnTheWayBody(
    @Json(name = "eta_start") val etaStart: String,
    @Json(name = "eta_end") val etaEnd: String,
)

/** `POST …/running-late`: 30, 60 or 90 minutes for every remaining home on [date]. */
@JsonClass(generateAdapter = true)
data class CrewDayRunningLateBody(
    @Json(name = "minutes") val minutes: Int,
    @Json(name = "date") val date: String?,
)

@JsonClass(generateAdapter = true)
data class CrewDayNoteBody(
    @Json(name = "note") val note: String?,
)

@JsonClass(generateAdapter = true)
data class CrewDayDoneBody(
    @Json(name = "photo_paths") val photoPaths: List<String>,
    @Json(name = "note") val note: String?,
)

/** A write that answers with a home on the crew's day or route. */
@JsonClass(generateAdapter = true)
data class CrewDayHomeResponse(
    @Json(name = "booking") val booking: CrewDayHomeDto,
)
