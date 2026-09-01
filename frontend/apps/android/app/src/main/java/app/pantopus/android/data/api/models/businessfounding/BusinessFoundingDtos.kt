@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.businessfounding

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * First-50 "Founding Business" offer.
 * Status: `backend/routes/businessFounding.js:80`.
 * Claim:  `backend/routes/businessFounding.js:218`.
 *
 * Mirrors iOS `BusinessFoundingDTOs.swift`.
 */
@JsonClass(generateAdapter = true)
data class FoundingOfferStatusDto(
    @Json(name = "total_slots") val totalSlots: Int? = null,
    @Json(name = "slots_claimed") val slotsClaimed: Int? = null,
    @Json(name = "slots_remaining") val slotsRemaining: Int? = null,
    @Json(name = "is_offer_active") val isOfferActive: Boolean? = null,
    @Json(name = "user_businesses") val userBusinesses: List<FoundingSlotDto>? = null,
)

/** One already-claimed slot row (`FoundingBusinessSlot`). */
@JsonClass(generateAdapter = true)
data class FoundingSlotDto(
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "slot_number") val slotNumber: Int? = null,
    @Json(name = "claimed_at") val claimedAt: String? = null,
    val status: String? = null,
)

/** 201 body from the claim route. */
@JsonClass(generateAdapter = true)
data class FoundingSlotClaimDto(
    @Json(name = "slot_number") val slotNumber: Int? = null,
    @Json(name = "claimed_at") val claimedAt: String? = null,
    val status: String? = null,
    @Json(name = "founding_badge") val foundingBadge: Boolean? = null,
    val message: String? = null,
)
