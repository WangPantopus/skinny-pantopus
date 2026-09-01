package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row of the `HomeIssue` table returned by
 * `GET /api/homes/:id/issues` (`backend/routes/home.js:4386`, a
 * `select('*')` so every column is present but most are nullable).
 *
 * DISTINCT from `MaintenanceTaskDto` — that models the maintenance-task
 * log at `/api/homes/:id/maintenance` (`backend/routes/home.js:4695`).
 */
@JsonClass(generateAdapter = true)
data class HomeIssueDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    val title: String,
    val description: String? = null,
    /**
     * `open` (default) / `suggested` / `scheduled` / `in_progress` /
     * `completed` / `dismissed`. Not enum-constrained server-side.
     */
    val status: String? = null,
    /** `low` / `medium` (default) / `high` / `urgent`. */
    val severity: String? = null,
    @Json(name = "reported_by") val reportedBy: String? = null,
    @Json(name = "assigned_vendor_id") val assignedVendorId: String? = null,
    @Json(name = "estimated_cost") val estimatedCost: Double? = null,
    @Json(name = "linked_gig_id") val linkedGigId: String? = null,
    @Json(name = "resolved_at") val resolvedAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** Envelope for `GET /api/homes/:id/issues` — `backend/routes/home.js:4410`. */
@JsonClass(generateAdapter = true)
data class HomeIssuesResponse(
    val issues: List<HomeIssueDto> = emptyList(),
)

/**
 * Envelope for `POST` / `PUT` — both reply `{ issue }`
 * (`backend/routes/home.js:4453` and `:4483`).
 */
@JsonClass(generateAdapter = true)
data class HomeIssueResponse(
    val issue: HomeIssueDto,
)

/**
 * Body for `POST /api/homes/:id/issues` (`backend/routes/home.js:4420`).
 * RN sends `title` + optional `description`
 * (`src/app/homes/[id]/maintenance.tsx:53`); the handler defaults
 * `severity` to `"medium"` and stamps `reported_by` from the token.
 */
@JsonClass(generateAdapter = true)
data class CreateHomeIssueRequest(
    val title: String,
    val description: String? = null,
    val severity: String? = null,
)

/**
 * Body for `PUT /api/homes/:id/issues/:issueId`
 * (`backend/routes/home.js:4462`). The handler merges only the keys it
 * receives, so null fields are omitted by Moshi's default behaviour.
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeIssueRequest(
    val title: String? = null,
    val description: String? = null,
    val status: String? = null,
    val severity: String? = null,
)
