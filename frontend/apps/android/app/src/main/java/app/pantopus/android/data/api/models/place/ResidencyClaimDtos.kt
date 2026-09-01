package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The Residency Pass (Wave 1): scoped, expiring, revocable residency
 * claims — the letter's live minimal-disclosure sibling. Vocabulary
 * enums are registered with the unknown-fallback factory: a scope or
 * status this build has never heard of renders inert, never as active,
 * and never fails the list. Parity: iOS `ResidencyClaimDTOs.swift`.
 */
enum class ResidencyClaimScope(val raw: String) {
    @Json(name = "address")
    ADDRESS("address"),

    @Json(name = "city")
    CITY("city"),

    @Json(name = "county")
    COUNTY("county"),

    @Json(name = "state")
    STATE("state"),

    @Json(name = "school_district")
    SCHOOL_DISTRICT("school_district"),

    @Json(name = "congressional_district")
    CONGRESSIONAL_DISTRICT("congressional_district"),

    UNKNOWN("unknown"),
}

/** `expired` is derived server-side; unrecognized statuses render inert. */
enum class ResidencyClaimStatus {
    @Json(name = "active")
    ACTIVE,

    @Json(name = "revoked")
    REVOKED,

    @Json(name = "expired")
    EXPIRED,
}

@JsonClass(generateAdapter = true)
data class ResidencyClaim(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val scope: ResidencyClaimScope = ResidencyClaimScope.UNKNOWN,
    /** The exact sentence a verifier sees — frozen at issue. */
    val statement: String,
    @Json(name = "holder_name") val holderName: String,
    val status: ResidencyClaimStatus = ResidencyClaimStatus.EXPIRED,
    @Json(name = "claim_code") val claimCode: String,
    @Json(name = "verify_url") val verifyUrl: String,
    @Json(name = "issued_at") val issuedAt: String,
    @Json(name = "expires_at") val expiresAt: String,
    @Json(name = "revoked_at") val revokedAt: String? = null,
    @Json(name = "residency_verified_at") val residencyVerifiedAt: String? = null,
    @Json(name = "view_count") val viewCount: Int = 0,
    @Json(name = "last_viewed_at") val lastViewedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class IssueResidencyClaimRequest(
    val scope: String,
    @Json(name = "expires_in_days") val expiresInDays: Int,
)

@JsonClass(generateAdapter = true)
data class ResidencyClaimResponse(
    val claim: ResidencyClaim,
)

@JsonClass(generateAdapter = true)
data class ResidencyClaimsResponse(
    val claims: List<ResidencyClaim> = emptyList(),
)
