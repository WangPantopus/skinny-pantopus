@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.earn

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.math.BigDecimal

/**
 * Wire models for the Mailbox Earn drawer's paid-offer wall —
 * `backend/routes/mailboxV2.js` EARN ENDPOINTS block (lines 793-1000).
 *
 * Advertisers fund `EarnOffer` rows; the user opens an envelope (creating
 * a pending `EarnTransaction`), dwells on it for the server's 15 000 ms
 * minimum, and the close call banks the reward. Balances are always read
 * back from `GET /earn/balance` — the client never increments locally.
 *
 * Column truth: `backend/database/migrations/046_mailbox_phase1.sql`
 * lines 155-198. Money columns are `numeric(10,2)`, which PostgREST may
 * hand back as a JSON string, so they decode through the globally
 * registered `BillDecimalAdapter` as [BigDecimal].
 *
 * Mirrors iOS `EarnOfferDTOs.swift`.
 */

/** Envelope for `GET /api/mailbox/v2/earn/offers`. */
@JsonClass(generateAdapter = true)
data class EarnOffersResponse(
    val offers: List<EarnOfferDto> = emptyList(),
)

/**
 * One `EarnOffer` row, enriched by the handler with the caller's
 * engagement (`opened` plus the matching `EarnTransaction`).
 */
@JsonClass(generateAdapter = true)
data class EarnOfferDto(
    val id: String,
    @Json(name = "business_name") val businessName: String? = null,
    @Json(name = "business_init") val businessInit: String? = null,
    /**
     * Advertiser brand hex. Not painted — the wall uses the shared
     * warm-amber Earn accent so it stays inside the token system.
     */
    @Json(name = "business_color") val businessColor: String? = null,
    @Json(name = "offer_title") val offerTitle: String? = null,
    @Json(name = "offer_subtitle") val offerSubtitle: String? = null,
    /** Only `POST /earn/reveal/:id` returns the promo code. */
    @Json(name = "offer_code") val offerCode: String? = null,
    @Json(name = "payout_amount") val payoutAmount: BigDecimal = BigDecimal.ZERO,
    @Json(name = "expires_at") val expiresAt: String? = null,
    /** `draft | active | paused | expired | completed`. */
    val status: String? = null,
    /** True when the caller already has an `EarnTransaction` for this offer. */
    val opened: Boolean = false,
    val transaction: EarnTransactionDto? = null,
)

/**
 * The caller's `EarnTransaction` projection selected by the offers
 * handler (`offer_id, status, dwell_ms, amount`).
 */
@JsonClass(generateAdapter = true)
data class EarnTransactionDto(
    /** `pending | verified | available | paid | flagged | rejected`. */
    val status: String? = null,
    @Json(name = "dwell_ms") val dwellMs: Int? = null,
    val amount: BigDecimal = BigDecimal.ZERO,
)

/**
 * Body for `POST /api/mailbox/v2/earn/open` — Joi `openOfferSchema`
 * (`backend/routes/mailboxV2.js:26`) requires a camelCase `offerId` uuid.
 */
@JsonClass(generateAdapter = true)
data class EarnOpenOfferRequest(
    val offerId: String,
)

/**
 * `POST /api/mailbox/v2/earn/open` 200 body. The daily cap answers **429**
 * with `{ capped: true }`, which surfaces as `NetworkError.ClientError(429)`
 * and never reaches this decoder.
 */
@JsonClass(generateAdapter = true)
data class EarnOpenOfferResponse(
    val message: String? = null,
    /** Payout recorded on the new pending transaction. */
    val amount: BigDecimal = BigDecimal.ZERO,
    /** Transaction status after the open (`pending`). */
    val status: String? = null,
    /** True when a transaction already existed for this offer. */
    val alreadyOpened: Boolean = false,
)

/**
 * Body for `POST /api/mailbox/v2/earn/close/:offerId` — Joi
 * `closeOfferSchema` (`backend/routes/mailboxV2.js:30`) requires a
 * camelCase `dwellMs` integer.
 */
@JsonClass(generateAdapter = true)
data class EarnCloseOfferRequest(
    val dwellMs: Long,
)

/**
 * `POST /api/mailbox/v2/earn/close/:offerId` response. `consumed` is the
 * server's verdict on the 15 000 ms minimum dwell — only `true` banks the
 * reward (transaction becomes `verified`).
 */
@JsonClass(generateAdapter = true)
data class EarnCloseOfferResponse(
    val consumed: Boolean = false,
    val dwellMs: Long? = null,
    val status: String? = null,
)

/** `POST /api/mailbox/v2/earn/save/:offerId` response. */
@JsonClass(generateAdapter = true)
data class EarnSaveOfferResponse(
    val message: String? = null,
)

/**
 * `POST /api/mailbox/v2/earn/reveal/:offerId` response — `code` is null
 * when the advertiser never attached a promo code.
 */
@JsonClass(generateAdapter = true)
data class EarnRevealOfferResponse(
    val code: String? = null,
)
