package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonDataException

/**
 * DTOs for the Home Emergency info endpoints under
 * `backend/routes/home.js`:
 *  - GET  /api/homes/:id/emergencies (line 5406)
 *  - POST /api/homes/:id/emergencies
 *  - PUT  /api/homes/:id/emergencies/:emergencyId
 *
 * Backend `HomeEmergency.type` is one of nine constants:
 *   shutoff_water · shutoff_gas · shutoff_electric · breaker_map ·
 *   extinguisher · first_aid · evac_plan · emergency_contacts · other
 * The GET response also includes `info_type` (== `type`) and
 * `location_in_home` (== `location`) aliases for older builds; the DTO
 * decodes only the canonical fields.
 */
@JsonClass(generateAdapter = true)
data class HomeEmergencyDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    /** Canonical type enum — drives the category-grouping bucket. */
    val type: String,
    /** User-supplied label (e.g. "Main water shutoff", "911"). */
    val label: String,
    /** Optional location hint (e.g. "Basement utility closet"). */
    val location: String?,
    /**
     * Free-form payload — the design uses `phone`, `address`, `detail`,
     * `reviewed`, `pinned`, and `needs_review` keys but no key is
     * enforced by the backend. Read the note through [noteText].
     */
    val details: Map<String, String>?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
) {
    /** The entry's free-text note, or null when it has none. */
    val noteText: String?
        get() = NOTE_KEYS.firstNotNullOfOrNull { key -> details?.get(key)?.takeIf { it.isNotEmpty() } }

    companion object {
        /**
         * Keys that hold the note, newest first. Every client writes `detail` (the key every installed app
         * version reads); entries saved on the web before that hold it as `notes`. An app edit of such an
         * entry writes `detail`, so `detail` wins.
         */
        val NOTE_KEYS = listOf("detail", "notes")
    }
}

/** `GET /api/homes/:id/emergencies` envelope. */
@JsonClass(generateAdapter = true)
data class GetHomeEmergenciesResponse(
    val emergencies: List<HomeEmergencyDto>,
    /** Effective authority from this same sensitive read; older servers leave the screen read-only. */
    val canManage: Boolean = false,
) {
    init {
        // Moshi can decode null array members despite the Kotlin element type.
        val rows: List<HomeEmergencyDto?> = emergencies
        if (rows.any { it == null }) {
            throw JsonDataException("Invalid emergency information response")
        }
    }
}

/**
 * `POST`/`PUT` emergency body. `clientRequestId` (create only) makes a retry of
 * an unchanged draft return the saved entry instead of adding it again.
 */
@JsonClass(generateAdapter = true)
data class CreateEmergencyRequest(
    val type: String,
    val label: String,
    val location: String? = null,
    val details: Map<String, String>? = null,
    val clientRequestId: String? = null,
)

/** `POST`/`PUT` emergency envelope. */
@JsonClass(generateAdapter = true)
data class CreateEmergencyResponse(
    val emergency: HomeEmergencyDto,
)

/** Envelope for `DELETE /api/homes/:id/emergencies/:emergencyId`. */
@JsonClass(generateAdapter = true)
data class DeleteEmergencyResponse(
    val message: String? = null,
)
