package app.pantopus.android.data.api.models.homediscovery

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the home-discovery / join-an-existing-home routes in
 * `backend/routes/home.js`. Field names are taken verbatim from the
 * handlers' `res.json({ … })` payloads.
 */

/** `{ homes: [...] }` — route `backend/routes/home.js:2433`. */
@JsonClass(generateAdapter = true)
data class HomeDiscoverResponse(
    val homes: List<DiscoveredHomeDto> = emptyList(),
)

/** One discover row — projection at `backend/routes/home.js:2400-2421`. */
@JsonClass(generateAdapter = true)
data class DiscoveredHomeDto(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    @Json(name = "home_type") val homeType: String? = null,
    val visibility: String? = null,
    val owner: DiscoveredHomeOwnerDto? = null,
    @Json(name = "is_member") val isMember: Boolean = false,
    @Json(name = "claim_status") val claimStatus: String? = null,
)

@JsonClass(generateAdapter = true)
data class DiscoveredHomeOwnerDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/**
 * Real `GET /api/homes/:id/public-profile` envelope — route
 * `backend/routes/home.js:2533`. The legacy `HomePublicProfileResponse`
 * in `homes/HomeDtos.kt` models an older shape; this one decodes the
 * handler's actual payload.
 */
@JsonClass(generateAdapter = true)
data class HomePublicPreviewResponse(
    val home: HomePublicPreviewDto,
    val owner: DiscoveredHomeOwnerDto? = null,
    @Json(name = "has_verified_owner") val hasVerifiedOwner: Boolean = false,
    @Json(name = "is_member") val isMember: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class HomePublicPreviewDto(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    @Json(name = "home_type") val homeType: String? = null,
) {
    /** "412 Elm St · Brooklyn, NY 11211" style label. */
    val displayAddress: String
        get() {
            val locality = listOfNotNull(city, state, zipcode).map { it.trim() }.filter { it.isNotEmpty() }
            val street = (address ?: name).orEmpty().trim()
            return when {
                street.isEmpty() -> locality.joinToString(", ")
                locality.isEmpty() -> street
                else -> "$street · ${locality.joinToString(", ")}"
            }
        }
}

/**
 * Body for `POST /api/homes/:id/request-household-from-owner`. Joi
 * schema at `backend/routes/home.js:163` accepts
 * `owner | resident | household_member | guest` (default `owner`).
 */
@JsonClass(generateAdapter = true)
data class RequestHouseholdFromOwnerRequest(
    @Json(name = "requested_identity") val requestedIdentity: String = "owner",
)

/** `{ ok, notified_owners }` — route `backend/routes/home.js:2657`. */
@JsonClass(generateAdapter = true)
data class RequestHouseholdFromOwnerResponse(
    val ok: Boolean = true,
    @Json(name = "notified_owners") val notifiedOwners: Int = 0,
)

/**
 * Body for the provisional residency claim — handler destructure at
 * `backend/routes/home.js:6482`.
 */
@JsonClass(generateAdapter = true)
data class SubmitResidencyClaimRequest(
    @Json(name = "claimed_address") val claimedAddress: String? = null,
    @Json(name = "claimed_role") val claimedRole: String? = null,
)

/** `{ message, claim }` — route `backend/routes/home.js:6479`. */
@JsonClass(generateAdapter = true)
data class SubmitResidencyClaimResponse(
    val message: String? = null,
    val claim: ResidencyClaimRowDto? = null,
)

@JsonClass(generateAdapter = true)
data class ResidencyClaimRowDto(
    val id: String,
    val status: String? = null,
    @Json(name = "home_id") val homeId: String? = null,
)
