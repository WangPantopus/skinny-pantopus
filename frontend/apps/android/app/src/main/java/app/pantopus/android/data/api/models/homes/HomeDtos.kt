package app.pantopus.android.data.api.models.homes

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Stable fields from a Home row. Additional columns not listed here are
 * ignored by the JSON adapter. Route citations live on the response
 * envelopes below.
 */
@JsonClass(generateAdapter = true)
data class HomeDto(
    val id: String,
    val name: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipcode: String?,
    @Json(name = "home_type") val homeType: String?,
    val visibility: String?,
    val description: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
)

/**
 * Occupancy badge emitted per-home in `my-homes`. Route:
 * `backend/routes/home.js:1464`.
 */
@JsonClass(generateAdapter = true)
data class HomeOccupancy(
    val id: String,
    val role: String,
    @Json(name = "role_base") val roleBase: String,
    @Json(name = "is_active") val isActive: Boolean,
    @Json(name = "start_at") val startAt: String?,
    @Json(name = "end_at") val endAt: String?,
    @Json(name = "verification_status") val verificationStatus: String,
)

/**
 * `GET /api/homes/my-homes` entry. The home-columns fields are mixed in at
 * the top level with the badge fields below; we decode the home and the
 * badges as sibling properties (`@Json` tags align field-by-field).
 * Route: `backend/routes/home.js:1464`.
 */
@JsonClass(generateAdapter = true)
data class MyHome(
    val id: String,
    val name: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipcode: String?,
    @Json(name = "home_type") val homeType: String?,
    val visibility: String?,
    val description: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
    val occupancy: HomeOccupancy?,
    @Json(name = "ownership_status") val ownershipStatus: String?,
    @Json(name = "verification_tier") val verificationTier: String?,
    @Json(name = "is_primary_owner") val isPrimaryOwner: Boolean?,
    @Json(name = "pending_claim_id") val pendingClaimId: String?,
    val location: HomeLocation? = null,
    /**
     * Server-computed predicate — true when the viewer owns the Home row
     * outright or is a verified *primary* owner. Gates the destructive
     * "Delete home" affordance; everyone else must leave instead.
     * Computed at `backend/routes/home.js:1653`.
     */
    @Json(name = "can_delete_home") val canDeleteHome: Boolean? = null,
)

/** Human-readable area label for the compose target picker. */
fun MyHome.areaLabel(): String {
    val parts = listOfNotNull(city, state).map { it.trim() }.filter { it.isNotEmpty() }
    if (parts.isNotEmpty()) return parts.joinToString(", ")
    return address ?: name ?: "Home"
}

/** `GET /api/homes/my-homes` envelope — route `backend/routes/home.js:1464`. */
@JsonClass(generateAdapter = true)
data class MyHomesResponse(
    val homes: List<MyHome>,
    val message: String?,
)

/** `GET /api/homes/:id` envelope — route `backend/routes/home.js:2891`. */
@JsonClass(generateAdapter = true)
data class HomeDetailResponse(
    val home: HomeDetail,
)

@JsonClass(generateAdapter = true)
data class HomeDetail(
    val id: String,
    val name: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipcode: String?,
    @Json(name = "home_type") val homeType: String?,
    val visibility: String?,
    val description: String?,
    @Json(name = "created_at") val createdAt: String?,
    val owner: HomeUserRef?,
    val occupants: List<HomeOccupant> = emptyList(),
    val location: HomeLocation?,
    val isOwner: Boolean = false,
    val isPendingOwner: Boolean = false,
    val pendingClaimId: String?,
    val isOccupant: Boolean = false,
    val owners: List<HomeOwnershipRef> = emptyList(),
    @Json(name = "can_delete_home") val canDeleteHome: Boolean = false,
    /**
     * `Home.security_state` — the lifecycle guard rail
     * (`normal | claim_window | review_required | disputed | frozen |
     * frozen_silent`). The handler `select('*')`s the Home row
     * (`backend/routes/home.js:2902`), so this and `claim_window_ends_at`
     * ride along on every detail read. Drives the dashboard status
     * banner.
     */
    @Json(name = "security_state") val securityState: String? = null,
    @Json(name = "claim_window_ends_at") val claimWindowEndsAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class HomeUserRef(
    val id: String,
    val username: String,
    val name: String,
)

@JsonClass(generateAdapter = true)
data class HomeOccupant(
    @Json(name = "user_id") val userId: String,
    @Json(name = "created_at") val createdAt: String,
    val user: HomeUserRef,
)

@JsonClass(generateAdapter = true)
data class HomeLocation(
    val longitude: Double,
    val latitude: Double,
)

@JsonClass(generateAdapter = true)
data class HomeOwnershipRef(
    val id: String,
    @Json(name = "subject_type") val subjectType: String,
    @Json(name = "subject_id") val subjectId: String,
    @Json(name = "owner_status") val ownerStatus: String,
    @Json(name = "is_primary_owner") val isPrimaryOwner: Boolean,
    @Json(name = "verification_tier") val verificationTier: String,
)

/** `GET /api/homes/:id/public-profile` envelope — route `backend/routes/home.js:2439`. */
@JsonClass(generateAdapter = true)
data class HomePublicProfileResponse(
    val home: HomePublicProfile,
)

@JsonClass(generateAdapter = true)
data class HomePublicProfile(
    val id: String,
    val name: String?,
    val address: String,
    val city: String,
    val state: String,
    val zipcode: String,
    @Json(name = "home_type") val homeType: String?,
    val visibility: String,
    val description: String?,
    @Json(name = "created_at") val createdAt: String,
    val hasVerifiedOwner: Boolean,
    val verifiedOwner: VerifiedOwner?,
    val userMembershipStatus: String,
    val userResidencyClaim: ResidencyClaim?,
    val memberCount: Int,
    val nearbyGigs: Int,
) {
    @JsonClass(generateAdapter = true)
    data class VerifiedOwner(
        val id: String,
        val username: String,
        val name: String,
        @Json(name = "first_name") val firstName: String,
        @Json(name = "last_name") val lastName: String,
        @Json(name = "profile_picture_url") val profilePictureUrl: String?,
    )

    @JsonClass(generateAdapter = true)
    data class ResidencyClaim(
        val id: String,
        val status: String,
        @Json(name = "created_at") val createdAt: String,
    )
}

/**
 * `POST /api/homes` request. Route: `backend/routes/home.js:677`. Supports
 * the commonly-used fields; callers pass any ATTOM payload through
 * [attomPropertyDetail] — its schema is provider-defined.
 */
@JsonClass(generateAdapter = true)
data class CreateHomeRequest(
    val address: String,
    @Json(name = "unit_number") val unitNumber: String? = null,
    val city: String,
    val state: String,
    @Json(name = "zip_code") val zipCode: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "home_type") val homeType: String? = null,
    val visibility: String? = null,
    val name: String? = null,
    val description: String? = null,
    /** `bedrooms` — `createHomeSchema` (`backend/routes/home.js:94`). */
    val bedrooms: Int? = null,
    /** `bathrooms` — accepts halves (`backend/routes/home.js:95`). */
    val bathrooms: Double? = null,
    /** `sq_ft` — `backend/routes/home.js:96`. */
    @Json(name = "sq_ft") val sqFt: Int? = null,
    /** `lot_sq_ft` — `backend/routes/home.js:98`. */
    @Json(name = "lot_sq_ft") val lotSqFt: Int? = null,
    /** `year_built` — `backend/routes/home.js:99`. */
    @Json(name = "year_built") val yearBuilt: Int? = null,
    /** `is_owner` — `backend/routes/home.js:101`. */
    @Json(name = "is_owner") val isOwner: Boolean? = null,
    /**
     * `role` — one of `owner | renter | household | property_manager |
     * guest` (`backend/routes/home.js:102`).
     */
    val role: String? = null,
    @Json(name = "attom_property_detail") val attomPropertyDetail: JsonValue? = null,
)

/** `POST /api/homes` response — route `backend/routes/home.js:677`. */
@JsonClass(generateAdapter = true)
data class CreateHomeResponse(
    val message: String,
    val home: HomeDto,
    @Json(name = "requires_verification") val requiresVerification: Boolean,
    @Json(name = "verification_type") val verificationType: String?,
    val role: String,
)

/**
 * `POST /api/homes/property-suggestions` request. Route:
 * `backend/routes/home.js:540`.
 */
@JsonClass(generateAdapter = true)
data class PropertySuggestionsRequest(
    val address: String,
    @Json(name = "unit_number") val unitNumber: String? = null,
    val city: String,
    val state: String,
    @Json(name = "zip_code") val zipCode: String,
    @Json(name = "address_id") val addressId: String? = null,
    /**
     * Optional Places / parcel hints forwarded from address validation —
     * `propertySuggestionsSchema` (`backend/routes/home.js:528-532`).
     */
    val classification: PropertySuggestionsClassification? = null,
)

/** Places / parcel classification hints (`backend/routes/home.js:528-532`). */
@JsonClass(generateAdapter = true)
data class PropertySuggestionsClassification(
    @Json(name = "google_place_types") val googlePlaceTypes: List<String>? = null,
    @Json(name = "parcel_type") val parcelType: String? = null,
    @Json(name = "building_type") val buildingType: String? = null,
)

/**
 * The merged property fields the tiered lookup resolved. Every field is
 * nullable — the service returns explicit nulls for anything ATTOM,
 * heuristics, or the LLM couldn't fill
 * (`backend/services/ai/propertySuggestionsService.js:144-152`).
 */
@JsonClass(generateAdapter = true)
data class PropertySuggestionsFields(
    @Json(name = "home_type") val homeType: String? = null,
    val bedrooms: Int? = null,
    val bathrooms: Double? = null,
    @Json(name = "sq_ft") val sqFt: Int? = null,
    @Json(name = "lot_sq_ft") val lotSqFt: Int? = null,
    @Json(name = "year_built") val yearBuilt: Int? = null,
    val description: String? = null,
)

/**
 * `POST /api/homes/property-suggestions` response envelope —
 * `backend/services/ai/propertySuggestionsService.js:261-267`. The
 * `attom_property_detail` bundle is provider-defined, so it stays an
 * untyped [JsonValue] that we hand straight back to `POST /api/homes`.
 */
@JsonClass(generateAdapter = true)
data class PropertySuggestionsResponse(
    val suggestions: PropertySuggestionsFields? = null,
    /** Per-field provenance (`attom` / `heuristic` / `llm`). */
    @Json(name = "field_sources") val fieldSources: Map<String, String>? = null,
    @Json(name = "tiers_used") val tiersUsed: List<String>? = null,
    @Json(name = "llm_enabled") val llmEnabled: Boolean? = null,
    @Json(name = "attom_property_detail") val attomPropertyDetail: JsonValue? = null,
) {
    /**
     * True when ATTOM actually returned a public record for the address —
     * drives the "Public records (ATTOM)" card. RN keys off the same
     * field (`DetailsStep.tsx:53`).
     */
    val hasAttomRecord: Boolean
        get() = !attomPropertyDetail.isNullOrEmpty()
}

/**
 * `POST /api/homes/check-address` request. Route:
 * `backend/routes/home.js:555`.
 */
@JsonClass(generateAdapter = true)
data class CheckAddressRequest(
    @Json(name = "address_id") val addressId: String? = null,
    val address: String,
    @Json(name = "unit_number") val unitNumber: String? = null,
    val city: String,
    val state: String,
    @Json(name = "zip_code") val zipCode: String,
    val country: String? = null,
)

/**
 * `POST /api/homes/check-address` response.
 *
 * The handler (`backend/routes/home.js:635` / `:661`) returns
 * `{ status, home_id?, is_multi_unit, formatted_address? }` where
 * `status` is `HOME_NOT_FOUND | HOME_FOUND_UNCLAIMED | HOME_FOUND_CLAIMED`.
 * The older `exists / homeCount / hasVerifiedMembers` triple is kept as a
 * derived convenience so existing call sites keep compiling.
 */
@JsonClass(generateAdapter = true)
data class CheckAddressResponse(
    val status: String? = null,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "is_multi_unit") val isMultiUnit: Boolean = false,
    @Json(name = "formatted_address") val formattedAddress: String? = null,
    @Json(name = "exists") val existsRaw: Boolean? = null,
    @Json(name = "homeCount") val homeCountRaw: Int? = null,
    @Json(name = "hasVerifiedMembers") val hasVerifiedMembersRaw: Boolean? = null,
    @Json(name = "verdict_status") val verdictStatus: String? = null,
    @Json(name = "normalized_address") val normalizedAddress: NormalizedAddressDto? = null,
) {
    /**
     * `status === 'HOME_FOUND_CLAIMED'` — an existing home at this
     * address already has active occupants, so `POST /api/homes` would
     * duplicate it. RN shows `AddressClaimedModal` here.
     */
    val isAlreadyClaimed: Boolean get() = status == STATUS_FOUND_CLAIMED

    /** `status === 'HOME_FOUND_UNCLAIMED'` — home row with no occupants. */
    val isFoundUnclaimed: Boolean get() = status == STATUS_FOUND_UNCLAIMED

    val exists: Boolean
        get() = existsRaw ?: (status == STATUS_FOUND_CLAIMED || status == STATUS_FOUND_UNCLAIMED)

    val homeCount: Int get() = homeCountRaw ?: if (homeId == null) 0 else 1

    val hasVerifiedMembers: Boolean get() = hasVerifiedMembersRaw ?: (status == STATUS_FOUND_CLAIMED)

    companion object {
        const val STATUS_NOT_FOUND = "HOME_NOT_FOUND"
        const val STATUS_FOUND_UNCLAIMED = "HOME_FOUND_UNCLAIMED"
        const val STATUS_FOUND_CLAIMED = "HOME_FOUND_CLAIMED"
    }
}

/** Canonical address returned when validation/geocoding normalizes input. */
@JsonClass(generateAdapter = true)
data class NormalizedAddressDto(
    val address: String? = null,
    val street: String? = null,
    @Json(name = "address_line1") val addressLine1: String? = null,
    val unit: String? = null,
    @Json(name = "unit_number") val unitNumber: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipCode: String? = null,
    @Json(name = "zip_code") val zipCodeSnake: String? = null,
    val zipcode: String? = null,
    val postalCode: String? = null,
    @Json(name = "postal_code") val postalCodeSnake: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    @Json(name = "is_multi_unit") val isMultiUnit: Boolean? = null,
)
