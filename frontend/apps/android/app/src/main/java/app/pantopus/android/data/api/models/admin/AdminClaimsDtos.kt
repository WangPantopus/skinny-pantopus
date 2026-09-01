@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.admin

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the admin Review-claims surface (P1.1). Mirrors iOS
 * `AdminClaimsDTOs.swift` and the web client's `api.admin.*` shape —
 * same field names, decoded directly from `backend/routes/admin.js`'s
 * enriched `/claims` payload.
 *
 * Routes:
 *   GET  /api/admin/claims?bucket=         backend/routes/admin.js:156
 *   GET  /api/admin/claims/counts          backend/routes/admin.js:230
 *   GET  /api/admin/claims/:claimId        backend/routes/admin.js:260
 *   POST /api/admin/claims/:claimId/review backend/routes/admin.js:342
 */

/**
 * Tab bucket on the admin Review-claims queue. The server uses the same
 * vocabulary to filter — `pending` collapses
 * `submitted | pending_review | needs_more_info | disputed` per
 * `BUCKET_STATES` in `backend/routes/admin.js`.
 */
enum class AdminClaimBucket(val backendValue: String) {
    Pending("pending"),
    Approved("approved"),
    Rejected("rejected"),
    ;

    companion object {
        fun fromBackend(value: String?): AdminClaimBucket = entries.firstOrNull { it.backendValue == value } ?: Pending
    }
}

/**
 * Action posted to `/api/admin/claims/:claimId/review`. The handler
 * rejects anything outside this set with a 400.
 */
enum class AdminClaimReviewAction(val backendValue: String) {
    Approve("approve"),
    Reject("reject"),

    /**
     * `Challenge` keeps the legacy `request_more_info` wire value — the
     * A13.3 reshape renamed the reviewer-facing verdict from "Request more
     * info" to "Challenge" (an inline composer with reason chips), but the
     * backend route still classifies it as `request_more_info` and flips
     * the claim into the `challenged` phase
     * (`backend/routes/admin.js:399`).
     */
    Challenge("request_more_info"),
}

/** Enriched home payload joined onto every admin claim row. */
@JsonClass(generateAdapter = true)
data class AdminClaimHomeDto(
    val id: String,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipcode: String?,
    val name: String?,
    @Json(name = "home_type") val homeType: String?,
)

/** Enriched claimant payload joined onto every admin claim row. */
@JsonClass(generateAdapter = true)
data class AdminClaimUserDto(
    val id: String,
    val username: String?,
    val name: String?,
    val email: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "profile_picture_url") val profilePictureUrl: String?,
)

/** One row in the admin claims queue. */
@JsonClass(generateAdapter = true)
data class AdminClaimDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claimant_user_id") val claimantUserId: String,
    @Json(name = "claim_type") val claimType: String?,
    val state: String,
    val method: String?,
    @Json(name = "risk_score") val riskScore: Int?,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String?,
    @Json(name = "evidence_count") val evidenceCount: Int,
    val home: AdminClaimHomeDto?,
    val claimant: AdminClaimUserDto?,
)

/**
 * Envelope returned by `GET /api/admin/claims`. `oldestAgeSeconds` is
 * only populated for the `pending` bucket and drives the queue banner's
 * "Oldest in queue: …" subtitle.
 */
@JsonClass(generateAdapter = true)
data class AdminClaimsResponse(
    val claims: List<AdminClaimDto>,
    val total: Int,
    @Json(name = "oldest_age_seconds") val oldestAgeSeconds: Int? = null,
)

/**
 * Envelope returned by `GET /api/admin/claims/counts`. Drives the
 * per-bucket count badges on the tab strip.
 */
@JsonClass(generateAdapter = true)
data class AdminClaimCountsResponse(
    val pending: Int,
    val approved: Int,
    val rejected: Int,
)

/**
 * Single evidence item attached to a claim. Mirrors the projection
 * built in `/api/admin/claims/:claimId` — file URL is presigned.
 */
@JsonClass(generateAdapter = true)
data class AdminClaimEvidenceDto(
    val id: String,
    @Json(name = "evidence_type") val evidenceType: String,
    val provider: String?,
    val status: String?,
    @Json(name = "storage_ref") val storageRef: String?,
    @Json(name = "file_url") val fileUrl: String?,
    @Json(name = "file_name") val fileName: String?,
    @Json(name = "file_size") val fileSize: Int?,
    @Json(name = "mime_type") val mimeType: String?,
    @Json(name = "created_at") val createdAt: String,
)

/**
 * Embedded claim payload inside the detail envelope. Carries the same
 * state-machine fields the reviewer reads.
 */
@JsonClass(generateAdapter = true)
data class AdminClaimRecordDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claimant_user_id") val claimantUserId: String,
    @Json(name = "claim_type") val claimType: String?,
    val state: String,
    val method: String?,
    @Json(name = "risk_score") val riskScore: Int?,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String?,
    @Json(name = "reviewed_by") val reviewedBy: String?,
    @Json(name = "reviewed_at") val reviewedAt: String?,
    @Json(name = "review_note") val reviewNote: String?,
    // Claimant identity-verification state — `not_started | pending |
    // verified | failed`. Drives the "Verified ID" trust chip (A13.3).
    @Json(name = "identity_status") val identityStatus: String? = null,
)

/** Full claim detail envelope returned by `GET /api/admin/claims/:claimId`. */
@JsonClass(generateAdapter = true)
data class AdminClaimDetailResponse(
    val claim: AdminClaimRecordDto,
    val home: AdminClaimHomeDto?,
    val claimant: AdminClaimUserDto?,
    val evidence: List<AdminClaimEvidenceDto>,
)

/**
 * Request body for `POST /api/admin/claims/:claimId/review`. We store
 * the action as a plain String so the request serialises without
 * needing a custom Moshi enum adapter — call sites pass
 * [AdminClaimReviewAction.backendValue].
 */
@JsonClass(generateAdapter = true)
data class AdminClaimReviewRequest(
    val action: String,
    val note: String?,
)

/**
 * Generic ack returned by the review endpoint — we ignore most of the
 * body and refetch the bucket / counts on success.
 */
@JsonClass(generateAdapter = true)
data class AdminClaimReviewResponse(
    val action: String? = null,
    val newState: String? = null,
    val claimId: String? = null,
    val homeId: String? = null,
)
