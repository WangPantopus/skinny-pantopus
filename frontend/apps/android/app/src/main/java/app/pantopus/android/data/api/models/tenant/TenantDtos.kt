package app.pantopus.android.data.api.models.tenant

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Observed existing lease, checked by the server before admitting a request. */
@JsonClass(generateAdapter = true)
data class TenantRequestContextDto(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "lease_id") val leaseId: String?,
    @Json(name = "lease_state") val leaseState: String?,
)

@JsonClass(generateAdapter = true)
data class TenantHomeStatusResponse(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "request_context") val requestContext: TenantRequestContextDto,
    val lease: LeaseStatus? = null,
) {
    @JsonClass(generateAdapter = true)
    data class LeaseStatus(val state: String, val lease: TenantLeaseDto? = null)

    fun matches(homeId: String): Boolean {
        val context = requestContext
        val validLease =
            if (context.leaseId == null) {
                context.leaseState == null
            } else {
                context.leaseId.isNotBlank() && context.leaseState in setOf("pending", "active", "ended", "canceled")
            }
        val matchesHome = this.homeId == homeId && context.homeId == homeId
        return matchesHome && context.actorId.isNotBlank() && validLease
    }
}

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
    @Json(name = "request_context") val requestContext: TenantRequestContextDto? = null,
    @Json(name = "lease_file_id") val leaseFileId: String? = null,
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
    @Json(name = "lease_file_id") val leaseFileId: String? = null,
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

/** Safe private lease file metadata; no object key or public URL. */
@JsonClass(generateAdapter = true)
data class TenantLeaseFileSession(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "session_scope") val sessionScope: String,
) {
    fun matches(
        home: String,
        actor: String,
    ): Boolean =
        homeId == home && actorId == actor && LEASE_FILE_UUID.matches(homeId) &&
            LEASE_FILE_UUID.matches(actorId) && sessionScope.matches(Regex("^[a-f0-9]{64}$"))
}

@JsonClass(generateAdapter = true)
data class TenantLeaseFile(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "file_name") val fileName: String,
    @Json(name = "file_size") val fileSize: Int,
    @Json(name = "mime_type") val mimeType: String,
    val available: Boolean,
    @Json(name = "lease_id") val leaseId: String? = null,
) {
    fun matches(
        home: String,
        file: String,
    ): Boolean =
        homeId == home && id == file && LEASE_FILE_UUID.matches(homeId) && LEASE_FILE_UUID.matches(id) &&
            fileName.isNotBlank() && fileName.length <= MAX_NAME_LENGTH && fileSize in 1..MAX_BYTES &&
            mimeType in ALLOWED_MIMES && available && (leaseId == null || LEASE_FILE_UUID.matches(leaseId))

    companion object {
        const val MAX_BYTES = 25 * 1024 * 1024
        const val MAX_NAME_LENGTH = 255
        val ALLOWED_MIMES = setOf("application/pdf", "text/plain", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif")
    }
}

@JsonClass(generateAdapter = true)
data class TenantLeaseFileResponse(val file: TenantLeaseFile)

@JsonClass(generateAdapter = true)
data class TenantLeaseFileRemoval(val deleted: Boolean)

internal val LEASE_FILE_UUID = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
