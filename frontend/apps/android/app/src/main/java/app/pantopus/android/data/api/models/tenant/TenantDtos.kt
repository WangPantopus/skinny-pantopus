package app.pantopus.android.data.api.models.tenant

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the tenant ↔ landlord approval flow
 * (`backend/routes/landlordTenant.js`, mounted at `/api/v1` in
 * `backend/app.js:397`).
 */

/**
 * Body for `POST /api/v1/tenant/request-approval`. Validated by
 * `tenantRequestSchema` (`landlordTenant.js:60`): `home_id` is a
 * required uuid, `start_at` / `end_at` are ISO strings or null, and
 * `message` is capped at 1000 chars.
 */
@JsonClass(generateAdapter = true)
data class TenantRequestApprovalRequest(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    val message: String? = null,
)

/** 201 envelope — `{ lease }` (`landlordTenant.js:587`). */
@JsonClass(generateAdapter = true)
data class TenantRequestApprovalResponse(
    val lease: TenantLeaseDto,
)

/** A `HomeLease` row as returned by `POST /tenant/request-approval`. */
@JsonClass(generateAdapter = true)
data class TenantLeaseDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    /** `none | pending | active | denied | ended`. */
    val state: String? = null,
    val source: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val metadata: TenantLeaseMetadataDto? = null,
)

/** Free-form `metadata` jsonb written by the request-approval handler. */
@JsonClass(generateAdapter = true)
data class TenantLeaseMetadataDto(
    val message: String? = null,
    @Json(name = "denied_reason") val deniedReason: String? = null,
    @Json(name = "denied_at") val deniedAt: String? = null,
)

/** Body for `POST /api/v1/tenant/move-out` (`landlordTenant.js:69`). */
@JsonClass(generateAdapter = true)
data class TenantMoveOutRequest(
    @Json(name = "lease_id") val leaseId: String,
    val reason: String? = null,
)

/** `{ success }` envelope for move-out. */
@JsonClass(generateAdapter = true)
data class TenantMoveOutResponse(
    val success: Boolean = false,
)
