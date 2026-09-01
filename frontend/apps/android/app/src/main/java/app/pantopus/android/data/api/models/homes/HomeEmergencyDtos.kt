package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Home Emergency info endpoints under
 * `backend/routes/home.js`:
 *  - GET  /api/homes/:id/emergencies (line 5406)
 *  - POST /api/homes/:id/emergencies (line 5442)
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
     * enforced by the backend.
     */
    val details: Map<String, String>?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
)

/** `GET /api/homes/:id/emergencies` envelope. */
@JsonClass(generateAdapter = true)
data class GetHomeEmergenciesResponse(
    val emergencies: List<HomeEmergencyDto>,
)

/** `POST /api/homes/:id/emergencies` body. */
@JsonClass(generateAdapter = true)
data class CreateEmergencyRequest(
    val type: String,
    val label: String,
    val location: String? = null,
    val details: Map<String, String>? = null,
)

/** `POST /api/homes/:id/emergencies` envelope. */
@JsonClass(generateAdapter = true)
data class CreateEmergencyResponse(
    val emergency: HomeEmergencyDto,
)
