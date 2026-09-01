package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET /api/ai/pulse` — the Neighborhood Pulse, the
 * priority-ranked signal stream behind the Place "Today's Pulse"
 * surface. Route: `backend/routes/ai.js:332`. Mirrors the
 * `NeighborhoodPulse` shape in `frontend/packages/types/src/ai.ts`
 * and the iOS `NeighborhoodPulseDTOs.swift`.
 */

@JsonClass(generateAdapter = true)
data class PulseSignalAction(
    /** "create_gig" | "view" | "invite" (open vocabulary — render-only). */
    val type: String,
    val label: String,
    val route: String,
)

@JsonClass(generateAdapter = true)
data class PulseSignal(
    /**
     * "air_quality" | "weather" | "seasonal_suggestion" | "community" |
     * "local_services" (open vocabulary — render-only).
     */
    @Json(name = "signal_type") val signalType: String,
    val priority: Int,
    val title: String,
    val detail: String,
    val icon: String,
    val color: String,
    val actions: List<PulseSignalAction>? = null,
)

@JsonClass(generateAdapter = true)
data class PulseProperty(
    @Json(name = "year_built") val yearBuilt: Int? = null,
    val sqft: Int? = null,
    @Json(name = "estimated_value") val estimatedValue: Double? = null,
    @Json(name = "zip_median_value") val zipMedianValue: Double? = null,
    @Json(name = "property_type") val propertyType: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseNeighborhood(
    @Json(name = "median_home_value") val medianHomeValue: Double? = null,
    @Json(name = "median_household_income") val medianHouseholdIncome: Double? = null,
    @Json(name = "median_year_built") val medianYearBuilt: Int? = null,
    @Json(name = "walk_score") val walkScore: Int? = null,
    @Json(name = "walk_description") val walkDescription: String? = null,
    @Json(name = "transit_score") val transitScore: Int? = null,
    @Json(name = "bike_score") val bikeScore: Int? = null,
    @Json(name = "flood_zone") val floodZone: String? = null,
    @Json(name = "flood_zone_description") val floodZoneDescription: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseFirstActionNudge(
    val prompt: String,
    val route: String,
    @Json(name = "gig_category") val gigCategory: String? = null,
    @Json(name = "gig_title") val gigTitle: String? = null,
)

@JsonClass(generateAdapter = true)
data class PulseSeasonalContext(
    val season: String,
    val tip: String? = null,
    @Json(name = "first_action_nudge") val firstActionNudge: PulseFirstActionNudge? = null,
)

@JsonClass(generateAdapter = true)
data class PulseCommunityDensity(
    @Json(name = "neighbor_count") val neighborCount: Int,
    @Json(name = "density_message") val densityMessage: String,
    @Json(name = "invite_cta") val inviteCta: Boolean,
)

@JsonClass(generateAdapter = true)
data class PulseSource(
    val provider: String,
    @Json(name = "updated_at") val updatedAt: String,
)

@JsonClass(generateAdapter = true)
data class PulseMeta(
    @Json(name = "community_signals_count") val communitySignalsCount: Int,
    @Json(name = "external_signals_count") val externalSignalsCount: Int,
    @Json(name = "partial_failures") val partialFailures: List<String> = emptyList(),
    @Json(name = "computed_at") val computedAt: String,
)

@JsonClass(generateAdapter = true)
data class PulsePayload(
    val greeting: String,
    val summary: String,
    /** "active" | "quiet" | "advisory" | "alert" (open vocabulary). */
    @Json(name = "overall_status") val overallStatus: String,
    val property: PulseProperty? = null,
    val neighborhood: PulseNeighborhood? = null,
    val signals: List<PulseSignal> = emptyList(),
    @Json(name = "seasonal_context") val seasonalContext: PulseSeasonalContext,
    @Json(name = "community_density") val communityDensity: PulseCommunityDensity,
    val sources: List<PulseSource> = emptyList(),
    val meta: PulseMeta,
)

/** `GET /api/ai/pulse?homeId=` envelope. */
@JsonClass(generateAdapter = true)
data class NeighborhoodPulse(
    val pulse: PulsePayload,
)
