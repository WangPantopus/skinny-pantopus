@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * A12.8 — body for `POST /api/gigs/magic-post`
 * (`backend/routes/magicTask.js:397`). Both the magic and the classic
 * (manual-category) wizard paths post through this shape; `source_flow`
 * distinguishes them. The `draft` reuses [MagicDraftDto] so the parse
 * round-trips without re-mapping.
 */
@JsonClass(generateAdapter = true)
data class MagicPostBody(
    /** Raw describe text (min 3 chars — falls back to title + description on the classic path). */
    val text: String,
    val draft: MagicDraftDto,
    val location: MagicPostLocation? = null,
    /** Persona switching deferred — always null for now. */
    @Json(name = "beneficiary_user_id") val beneficiaryUserId: String? = null,
    /** "magic" | "classic". */
    @Json(name = "source_flow") val sourceFlow: String = "magic",
    /** "instant_accept" | "curated_offers" | "quotes". */
    @Json(name = "engagement_mode") val engagementMode: String? = null,
    /** T6.0b — "in_person" | "drop_off" | "remote" | "hybrid". */
    @Json(name = "task_format") val taskFormat: String? = null,
    @Json(name = "ai_confidence") val aiConfidence: Double? = null,
    /** Last raw backend draft, echoed for analytics (any object passes the Joi schema). */
    @Json(name = "ai_draft_json") val aiDraftJson: MagicDraftDto? = null,
)

/** Location block on the magic-post body. `place_id` stays snake_case (backend Joi). */
@JsonClass(generateAdapter = true)
data class MagicPostLocation(
    /** "home" | "address" | "current" | "custom". */
    val mode: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zip: String? = null,
    val homeId: String? = null,
    @Json(name = "place_id") val placeId: String? = null,
)

/** `201` envelope from `POST /api/gigs/magic-post`. */
@JsonClass(generateAdapter = true)
data class MagicPostResponse(
    val message: String? = null,
    val gig: MagicPostGigDto,
    @Json(name = "nearby_helpers") val nearbyHelpers: Int? = null,
    @Json(name = "notified_count") val notifiedCount: Int? = null,
)

/** The created gig + undo metadata riding the magic-post response. */
@JsonClass(generateAdapter = true)
data class MagicPostGigDto(
    val id: String,
    val title: String? = null,
    @Json(name = "undo_window_ms") val undoWindowMs: Long? = null,
    @Json(name = "can_undo") val canUndo: Boolean? = null,
)

/** Envelope from `POST /api/gigs/:gigId/undo` (`magicTask.js:682`). */
@JsonClass(generateAdapter = true)
data class MagicUndoResponse(
    val message: String? = null,
    val gigId: String? = null,
)

/** Envelope from `GET /api/gigs/templates/library` (`magicTask.js:326`). */
@JsonClass(generateAdapter = true)
data class GigTemplatesResponse(
    val templates: List<GigTemplateDto> = emptyList(),
)

/** One static smart-template chip for the empty describe state. */
@JsonClass(generateAdapter = true)
data class GigTemplateDto(
    val id: String,
    val label: String,
    /** Emoji glyph, e.g. "🛋️". */
    val icon: String? = null,
    val template: GigTemplateSeedDto? = null,
)

/** Seed fields inside a smart template (subset of the draft shape). */
@JsonClass(generateAdapter = true)
data class GigTemplateSeedDto(
    val title: String? = null,
    val category: String? = null,
    val tags: List<String>? = null,
    @Json(name = "pay_type") val payType: String? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
)
