@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/homes/:id/owners/transfer`. Mirrors
 * `transferOwnerSchema` (`backend/routes/homeOwnership.js:74`). All keys
 * are nullable; the buyer is identified by [buyerUserId] when picked
 * from a known account, or by [buyerEmail] / [buyerPhone] otherwise.
 * Null fields are omitted by Moshi. Field-for-field parity with iOS
 * `TransferOwnerRequest`.
 */
@JsonClass(generateAdapter = true)
data class TransferOwnerRequest(
    @Json(name = "buyer_email") val buyerEmail: String? = null,
    @Json(name = "buyer_phone") val buyerPhone: String? = null,
    @Json(name = "buyer_user_id") val buyerUserId: String? = null,
    @Json(name = "effective_date") val effectiveDate: String? = null,
)

/**
 * Envelope for `POST /api/homes/:id/owners/transfer`. The backend
 * returns a `transfer_claim_id` directly (200) for a sole owner, or a
 * `quorum_action_id` + `required_approvals` (201) when co-owners must
 * approve first. All shape-specific keys are optional so one type
 * decodes both. Field-for-field parity with iOS `TransferOwnerResponse`.
 */
@JsonClass(generateAdapter = true)
data class TransferOwnerResponse(
    val message: String,
    @Json(name = "transfer_claim_id") val transferClaimId: String? = null,
    @Json(name = "quorum_action_id") val quorumActionId: String? = null,
    @Json(name = "required_approvals") val requiredApprovals: Int? = null,
) {
    /** True when the backend deferred the transfer to a co-owner quorum. */
    val requiresQuorum: Boolean get() = quorumActionId != null
}
