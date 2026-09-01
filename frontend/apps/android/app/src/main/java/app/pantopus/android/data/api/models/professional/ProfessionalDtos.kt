package app.pantopus.android.data.api.models.professional

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `backend/routes/professional.js`. The backend professional record
 * is thin (headline / categories / pricing / verification); the editor maps
 * the overlapping fields.
 */

// GET /api/professional/profile/me — backend/routes/professional.js:164
// `{ profile: … | null }`; null means professional mode is off.
@JsonClass(generateAdapter = true)
data class ProfessionalProfileResponse(
    val profile: ProfessionalProfileDto? = null,
)

@JsonClass(generateAdapter = true)
data class ProfessionalProfileDto(
    val headline: String? = null,
    val bio: String? = null,
    val categories: List<String>? = null,
    @Json(name = "service_area") val serviceArea: ProfessionalServiceAreaDto? = null,
    @Json(name = "pricing_meta") val pricingMeta: ProfessionalPricingDto? = null,
    @Json(name = "is_public") val isPublic: Boolean? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "verification_tier") val verificationTier: Int? = null,
    @Json(name = "verification_status") val verificationStatus: String? = null,
)

@JsonClass(generateAdapter = true)
data class ProfessionalServiceAreaDto(
    val city: String? = null,
    val state: String? = null,
    // Joi types this as a plain `number`, so it can arrive as 50 or 50.0.
    @Json(name = "radius_km") val radiusKm: Double? = null,
)

@JsonClass(generateAdapter = true)
data class ProfessionalPricingDto(
    @Json(name = "hourly_rate") val hourlyRate: Double? = null,
    val currency: String? = null,
)

// GET /api/professional/verification/status — backend/routes/professional.js:372
@JsonClass(generateAdapter = true)
data class ProfessionalVerificationStatusResponse(
    val tier: Int? = null,
    val status: String? = null,
    @Json(name = "submitted_at") val submittedAt: String? = null,
    @Json(name = "completed_at") val completedAt: String? = null,
)

// POST /api/professional/verification/start — backend/routes/professional.js:310
// `tier` must be 1 or 2 (`professional.js:315`); RN sends 1 from the profile
// CTA (`professional.tsx:390`). Response is `{ message, verification_status }`.
@JsonClass(generateAdapter = true)
data class ProfessionalVerificationStartRequest(
    val tier: Int = 1,
)

@JsonClass(generateAdapter = true)
data class ProfessionalVerificationStartResponse(
    val message: String? = null,
    @Json(name = "verification_status") val verificationStatus: String? = null,
)

// Shared request sub-objects — `service_area` (radius 1…500) and
// `pricing_meta`, accepted by both the create and update schemas
// (backend/routes/professional.js:47 and :54).
@JsonClass(generateAdapter = true)
data class ProfessionalServiceAreaInput(
    val city: String? = null,
    val state: String? = null,
    @Json(name = "radius_km") val radiusKm: Int? = null,
) {
    /** True when there is nothing worth sending. */
    val isEmpty: Boolean
        get() = city.isNullOrEmpty() && state.isNullOrEmpty()
}

@JsonClass(generateAdapter = true)
data class ProfessionalPricingInput(
    @Json(name = "hourly_rate") val hourlyRate: Double? = null,
    val currency: String? = "USD",
)

// POST /api/professional/profile (request) — `createProfileSchema`
// (backend/routes/professional.js:42). `categories` must be drawn from the
// server enum, mirrored by `ProfessionalCategory`.
@JsonClass(generateAdapter = true)
data class ProfessionalEnableRequest(
    val headline: String? = null,
    val bio: String? = null,
    val categories: List<String>? = null,
    @Json(name = "service_area") val serviceArea: ProfessionalServiceAreaInput? = null,
    @Json(name = "pricing_meta") val pricingMeta: ProfessionalPricingInput? = null,
    @Json(name = "is_public") val isPublic: Boolean? = null,
)

// PATCH /api/professional/profile/me (request) — partial update. Null fields
// are omitted by Moshi (serializeNulls off). `is_active = true` is how a
// soft-disabled profile is switched back on (RN professional.tsx:141).
@JsonClass(generateAdapter = true)
data class ProfessionalProfileUpdateRequest(
    val headline: String? = null,
    val bio: String? = null,
    @Json(name = "is_public") val isPublic: Boolean? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    val categories: List<String>? = null,
    @Json(name = "service_area") val serviceArea: ProfessionalServiceAreaInput? = null,
    @Json(name = "pricing_meta") val pricingMeta: ProfessionalPricingInput? = null,
)
