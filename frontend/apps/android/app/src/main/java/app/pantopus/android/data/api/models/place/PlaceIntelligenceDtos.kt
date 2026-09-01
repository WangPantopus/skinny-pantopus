package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The Place Intelligence section-envelope contract. Mirrors the web
 * source of truth `frontend/packages/types/src/placeIntelligence.ts`,
 * the backend serializer
 * `backend/serializers/placeIntelligenceSerializer.js`, and the iOS
 * `PlaceIntelligenceDTOs.swift` — keep all four in lockstep.
 *
 * Decoding stance (parity with iOS): the section list is an OPEN set,
 * so section ids / groups keep their raw string plus a typed accessor
 * with an UNKNOWN fallback, and a malformed section payload degrades
 * that one section to `data = null` (see [PlaceSectionEnvelopeAdapterFactory])
 * rather than failing the whole response. Closed display vocabularies
 * (condition codes, buckets, …) decode unrecognized values to UNKNOWN
 * via [PlaceEnumAdapterFactory]. Contract drift is caught by the
 * fixture tests in `app/src/test/java/app/pantopus/android/place/`.
 */

// ─── Trust ladder / gating axes ──────────────────────────────

/** Trust ladder T0–T4 (product design doc §3). */
enum class PlaceTier {
    @Json(name = "T0")
    T0,

    @Json(name = "T1")
    T1,

    @Json(name = "T2")
    T2,

    @Json(name = "T3")
    T3,

    @Json(name = "T4")
    T4,
}

/**
 * Sensitivity band (§9.1): A public place · B public property record ·
 * C private inputs · D trust/identity tools.
 */
enum class PlaceBand {
    @Json(name = "A")
    A,

    @Json(name = "B")
    B,

    @Json(name = "C")
    C,

    @Json(name = "D")
    D,
}

/**
 * Per-section access for the viewer's tier. Unrecognized values decode
 * to [LOCKED] — never show data the client doesn't understand the
 * gating of.
 */
enum class PlaceSectionAccess {
    @Json(name = "available")
    AVAILABLE,

    @Json(name = "preview")
    PREVIEW,

    @Json(name = "locked")
    LOCKED,
}

/**
 * Data freshness/availability. Unrecognized values decode to
 * [UNAVAILABLE] (the quiet degraded state, not the noisy error one).
 */
enum class PlaceSectionStatus {
    @Json(name = "ready")
    READY,

    @Json(name = "partial")
    PARTIAL,

    @Json(name = "unavailable")
    UNAVAILABLE,

    @Json(name = "stale")
    STALE,

    @Json(name = "error")
    ERROR,
}

/** Source coverage for the address. Unrecognized values decode to [PARTIAL]. */
enum class PlaceCoverage {
    @Json(name = "full")
    FULL,

    @Json(name = "partial")
    PARTIAL,

    @Json(name = "none")
    NONE,
}

// ─── Groups + section ids (open sets — raw string preserved) ─

/** The eight curated presentation groups (§8.2) + UNKNOWN. */
enum class PlaceGroup(val raw: String) {
    TODAY("today"),
    YOUR_HOME("your_home"),
    RISK_READINESS("risk_readiness"),
    HEALTH_ENVIRONMENT("health_environment"),
    YOUR_BLOCK("your_block"),
    MONEY_SIGNALS("money_signals"),
    CIVIC("civic"),
    IDENTITY("identity"),
    UNKNOWN("unknown"),
    ;

    companion object {
        fun from(raw: String?): PlaceGroup = entries.firstOrNull { it.raw == raw } ?: UNKNOWN
    }
}

/** The 18 launch-set section ids + UNKNOWN. */
enum class PlaceSectionId(val raw: String) {
    WEATHER("weather"),
    AIR_QUALITY("air_quality"),
    ALERTS("alerts"),
    SUNRISE_SUNSET("sunrise_sunset"),
    YOUR_HOME("your_home"),
    FLOOD("flood"),
    SEISMIC("seismic"),
    WILDFIRE("wildfire"),
    LEAD_RADON("lead_radon"),
    DRINKING_WATER("drinking_water"),
    ENVIRONMENTAL_HAZARDS("environmental_hazards"),
    BLOCK_DENSITY("block_density"),
    CENSUS_CONTEXT("census_context"),
    BILL_BENCHMARK("bill_benchmark"),
    INCENTIVES("incentives"),
    RENT_BAND("rent_band"),
    CIVIC_DISTRICTS("civic_districts"),
    CIVIC_ELECTION("civic_election"),
    UNKNOWN("unknown"),
    ;

    companion object {
        fun from(raw: String?): PlaceSectionId = entries.firstOrNull { it.raw == raw } ?: UNKNOWN
    }
}

// ─── Today section payloads ──────────────────────────────────

/**
 * Weather condition vocabulary. The server always ships a human
 * `condition_label`, so UNKNOWN still renders — it only loses the glyph.
 */
enum class WeatherConditionCode {
    @Json(name = "clear")
    CLEAR,

    @Json(name = "partly_cloudy")
    PARTLY_CLOUDY,

    @Json(name = "cloudy")
    CLOUDY,

    @Json(name = "fog")
    FOG,

    @Json(name = "rain")
    RAIN,

    @Json(name = "snow")
    SNOW,

    @Json(name = "sleet")
    SLEET,

    @Json(name = "thunderstorm")
    THUNDERSTORM,

    @Json(name = "wind")
    WIND,
    UNKNOWN,
}

@JsonClass(generateAdapter = true)
data class PlaceWeatherHour(
    /** ISO 8601 timestamp for the hour. */
    val time: String,
    @Json(name = "temp_f") val tempF: Double,
    @Json(name = "condition_code") val conditionCode: WeatherConditionCode,
    /** 0–100. */
    @Json(name = "precip_chance") val precipChance: Double,
)

@JsonClass(generateAdapter = true)
data class PlaceWeatherDay(
    /** ISO 8601 date. */
    val date: String,
    @Json(name = "condition_code") val conditionCode: WeatherConditionCode,
    @Json(name = "high_f") val highF: Double,
    @Json(name = "low_f") val lowF: Double,
    /** 0–100. */
    @Json(name = "precip_chance") val precipChance: Double,
)

/** Launch layer #1 — Weather (NOAA / NWS). */
@JsonClass(generateAdapter = true)
data class PlaceWeatherData(
    @Json(name = "current_temp_f") val currentTempF: Double,
    @Json(name = "condition_code") val conditionCode: WeatherConditionCode,
    /** Human label, e.g. "Clear". */
    @Json(name = "condition_label") val conditionLabel: String,
    @Json(name = "feels_like_f") val feelsLikeF: Double? = null,
    @Json(name = "high_f") val highF: Double? = null,
    @Json(name = "low_f") val lowF: Double? = null,
    /** Hourly strip; may be empty on the dashboard summary. */
    val hourly: List<PlaceWeatherHour> = emptyList(),
    /** 5-day forecast; may be empty on the dashboard summary. */
    val daily: List<PlaceWeatherDay> = emptyList(),
)

enum class AirQualityCategory {
    @Json(name = "good")
    GOOD,

    @Json(name = "moderate")
    MODERATE,

    @Json(name = "unhealthy_sensitive")
    UNHEALTHY_SENSITIVE,

    @Json(name = "unhealthy")
    UNHEALTHY,

    @Json(name = "very_unhealthy")
    VERY_UNHEALTHY,

    @Json(name = "hazardous")
    HAZARDOUS,
    UNKNOWN,
}

/** Launch layer #2 — Air quality (AirNow / EPA). */
@JsonClass(generateAdapter = true)
data class PlaceAirQualityData(
    /** US Air Quality Index, e.g. 38. */
    val index: Int,
    val category: AirQualityCategory,
    /** Human label, e.g. "Good". */
    @Json(name = "category_label") val categoryLabel: String,
    /** e.g. "pm25" | "ozone"; null when unknown. */
    @Json(name = "dominant_pollutant") val dominantPollutant: String? = null,
    /** Plain "what it means" copy. */
    @Json(name = "health_message") val healthMessage: String,
)

enum class WeatherAlertSeverity {
    @Json(name = "advisory")
    ADVISORY,

    @Json(name = "watch")
    WATCH,

    @Json(name = "warning")
    WARNING,
    UNKNOWN,
}

@JsonClass(generateAdapter = true)
data class PlaceWeatherAlert(
    val id: String,
    /** e.g. "Wind Advisory". */
    val event: String,
    val severity: WeatherAlertSeverity,
    /** Short timing line, e.g. "In effect until 6:00 PM today". */
    val headline: String,
    /** Body copy / instruction. */
    val description: String,
    /** ISO 8601. */
    val onset: String? = null,
    /** ISO 8601. */
    val ends: String? = null,
)

/** NWS active alerts — an empty `active` list renders "No active alerts". */
@JsonClass(generateAdapter = true)
data class PlaceAlertsData(
    val active: List<PlaceWeatherAlert> = emptyList(),
)

/** Sunrise / sunset — rides the NOAA / Open-Meteo feed. */
@JsonClass(generateAdapter = true)
data class PlaceSunriseSunsetData(
    /** ISO 8601. */
    val sunrise: String,
    /** ISO 8601. */
    val sunset: String,
    @Json(name = "daylight_minutes") val daylightMinutes: Int,
)

// ─── Risk & readiness payloads ───────────────────────────────

enum class FloodRiskLevel {
    @Json(name = "minimal")
    MINIMAL,

    @Json(name = "moderate")
    MODERATE,

    @Json(name = "high")
    HIGH,
    UNKNOWN,
}

/** Launch layer #3 — Flood (FEMA National Flood Hazard Layer). */
@JsonClass(generateAdapter = true)
data class PlaceFloodData(
    /** FEMA zone code, e.g. "X". */
    val zone: String,
    /** Human label, e.g. "Zone X". */
    @Json(name = "zone_label") val zoneLabel: String,
    @Json(name = "risk_level") val riskLevel: FloodRiskLevel,
    /** Special Flood Hazard Area. */
    @Json(name = "in_sfha") val inSfha: Boolean,
    /** Federally-required flood insurance. */
    @Json(name = "insurance_required") val insuranceRequired: Boolean,
    /** Plain "what this means" copy. */
    @Json(name = "plain_meaning") val plainMeaning: String,
)

/** ASCE 7 seismic design categories (A lowest demand → E highest). */
enum class SeismicDesignCategory {
    @Json(name = "A")
    A,

    @Json(name = "B")
    B,

    @Json(name = "C")
    C,

    @Json(name = "D")
    D,

    @Json(name = "E")
    E,
    UNKNOWN,
}

/**
 * Phase-4 layer — Earthquake (USGS seismic design values, ASCE 7-22).
 * Engineering demand at this point, not a prediction. Informational.
 */
@JsonClass(generateAdapter = true)
data class PlaceSeismicData(
    @Json(name = "design_category") val designCategory: SeismicDesignCategory,
    /** Design spectral acceleration, short period (g). */
    val sds: Double? = null,
    val summary: String,
    val disclaimer: String,
)

/**
 * Phase-4 layer — Wildfire (USFS Wildfire Hazard Potential, 2023).
 * `hazardClass` is 1 (very low) → 5 (very high); null for non-burnable /
 * water pixels — `burnable: false` carries that meaning.
 */
@JsonClass(generateAdapter = true)
data class PlaceWildfireData(
    @Json(name = "hazard_class") val hazardClass: Int? = null,
    @Json(name = "hazard_label") val hazardLabel: String,
    val burnable: Boolean,
    val summary: String,
    val disclaimer: String,
)

// ─── Health & environment payloads ───────────────────────────

enum class LeadPaintRisk {
    @Json(name = "unlikely")
    UNLIKELY,

    @Json(name = "possible")
    POSSIBLE,

    @Json(name = "likely")
    LIKELY,
    UNKNOWN,
}

/** Launch layer #6 — Lead / radon screening. "Screening, not a diagnosis." */
@JsonClass(generateAdapter = true)
data class PlaceLeadRadonData(
    @Json(name = "year_built") val yearBuilt: Int? = null,
    @Json(name = "lead_paint_risk") val leadPaintRisk: LeadPaintRisk,
    /** EPA radon zone (1 = highest potential), 1–3. */
    @Json(name = "radon_zone") val radonZone: Int? = null,
    val summary: String,
    val disclaimer: String,
)

/** Launch layer #7 — Drinking-water system (EPA SDWIS; coverage ~80%). */
@JsonClass(generateAdapter = true)
data class PlaceDrinkingWaterData(
    /** e.g. "Portland Water Bureau". */
    @Json(name = "utility_name") val utilityName: String,
    /** Public Water System id. */
    @Json(name = "pws_id") val pwsId: String? = null,
    @Json(name = "recent_health_violations") val recentHealthViolations: Boolean,
    @Json(name = "violation_count") val violationCount: Int,
    val summary: String,
)

@JsonClass(generateAdapter = true)
data class PlaceEpaFacility(
    val name: String,
    /** Regulating program, e.g. "Clean Water Act". */
    val program: String,
    @Json(name = "distance_mi") val distanceMi: Double,
)

/**
 * Launch layer #5 — EPA environmental context (ECHO).
 * "Regulated activity nearby, not unsafe exposure." No toxic score.
 */
@JsonClass(generateAdapter = true)
data class PlaceEnvironmentalHazardsData(
    @Json(name = "facilities_within_mile") val facilitiesWithinMile: Int,
    @Json(name = "radius_mi") val radiusMi: Double,
    /** Facility list; may be empty on the dashboard summary. */
    val facilities: List<PlaceEpaFacility> = emptyList(),
    val summary: String,
    val disclaimer: String,
)

// ─── Your block payloads ─────────────────────────────────────

/**
 * k-anonymity bucket ONLY — never a count (floored server-side, §4.1).
 * The server-rendered `label` keeps UNKNOWN renderable.
 */
enum class PlaceDensityBucket {
    @Json(name = "none")
    NONE,

    @Json(name = "forming")
    FORMING,

    @Json(name = "few")
    FEW,

    @Json(name = "growing")
    GROWING,
    UNKNOWN,
}

/**
 * Launch layer #11 — Block density. Bucket + label only; intentionally
 * carries NO neighbor count.
 */
@JsonClass(generateAdapter = true)
data class PlaceBlockDensityData(
    val bucket: PlaceDensityBucket,
    /** Server-rendered bucket label. */
    val label: String,
)

/** Launch layer #4 — Census tract context (ACS; area-level, not your home). */
@JsonClass(generateAdapter = true)
data class PlaceCensusContextData(
    @Json(name = "median_year_built") val medianYearBuilt: Int? = null,
    @Json(name = "median_home_value") val medianHomeValue: Double? = null,
    @Json(name = "tract_name") val tractName: String? = null,
    val summary: String,
)

// ─── Money signals payloads ──────────────────────────────────

enum class BillUtilityKind {
    @Json(name = "electric")
    ELECTRIC,

    @Json(name = "gas")
    GAS,

    @Json(name = "water")
    WATER,
    UNKNOWN,
}

enum class BenchmarkComparison {
    @Json(name = "lower")
    LOWER,

    @Json(name = "typical")
    TYPICAL,

    @Json(name = "higher")
    HIGHER,
    UNKNOWN,
}

/** Launch layer #12 — Bill benchmark (peer-relative; informational). */
@JsonClass(generateAdapter = true)
data class PlaceBillBenchmarkData(
    val utility: BillUtilityKind,
    /** Resident's own amount (Band C); null until they provide it. */
    @Json(name = "your_amount") val yourAmount: Double? = null,
    /** Typical-for-area band. */
    @Json(name = "band_low") val bandLow: Double,
    @Json(name = "band_high") val bandHigh: Double,
    val comparison: BenchmarkComparison,
    /** Signed percent vs neighbors: +12 = 12% above, -10 = 10% below. */
    @Json(name = "comparison_pct") val comparisonPct: Double,
    /** e.g. "12-month average". */
    val period: String,
    val summary: String,
)

enum class IncentiveLevel {
    @Json(name = "federal")
    FEDERAL,

    @Json(name = "state")
    STATE,

    @Json(name = "utility")
    UTILITY,

    @Json(name = "local")
    LOCAL,
    UNKNOWN,
}

enum class IncentiveType {
    @Json(name = "tax_credit")
    TAX_CREDIT,

    @Json(name = "rebate")
    REBATE,

    @Json(name = "discount")
    DISCOUNT,

    @Json(name = "loan")
    LOAN,
    UNKNOWN,
}

@JsonClass(generateAdapter = true)
data class PlaceIncentive(
    val id: String,
    val name: String,
    val level: IncentiveLevel,
    @Json(name = "incentive_type") val incentiveType: IncentiveType,
    val summary: String,
)

/** Launch layer #10 — Incentives (DSIRE; "you may be eligible — verify"). */
@JsonClass(generateAdapter = true)
data class PlaceIncentivesData(
    val programs: List<PlaceIncentive> = emptyList(),
    val summary: String,
)

/** Launch layer #9 — Rent band (HUD Fair Market Rents; informational). */
@JsonClass(generateAdapter = true)
data class PlaceRentBandData(
    val bedrooms: Int,
    /** Market band low/high. */
    @Json(name = "band_low") val bandLow: Double,
    @Json(name = "band_high") val bandHigh: Double,
    /** Full track min/max for the comparison bar. */
    @Json(name = "market_low") val marketLow: Double,
    @Json(name = "market_high") val marketHigh: Double,
    /** e.g. "FY 2026". */
    val period: String,
    val summary: String,
)

// ─── Civic payloads ──────────────────────────────────────────

enum class CivicLevel {
    @Json(name = "federal")
    FEDERAL,

    @Json(name = "state")
    STATE,

    @Json(name = "county")
    COUNTY,

    @Json(name = "city")
    CITY,

    @Json(name = "school")
    SCHOOL,
    UNKNOWN,
}

@JsonClass(generateAdapter = true)
data class PlaceCivicDistrict(
    val level: CivicLevel,
    /** e.g. "U.S. House". */
    @Json(name = "office_label") val officeLabel: String,
    /** e.g. "Oregon's 3rd District". */
    val name: String,
)

@JsonClass(generateAdapter = true)
data class PlaceCivicRepresentative(
    val name: String,
    val office: String,
    val level: CivicLevel,
    val party: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val website: String? = null,
)

/**
 * Launch layer #8 (evergreen half) — Civic districts. Districts are
 * always present; representatives may be empty until their companion
 * source ships.
 */
@JsonClass(generateAdapter = true)
data class PlaceCivicDistrictsData(
    val districts: List<PlaceCivicDistrict> = emptyList(),
    val representatives: List<PlaceCivicRepresentative> = emptyList(),
)

enum class BallotRaceType {
    @Json(name = "office")
    OFFICE,

    @Json(name = "measure")
    MEASURE,
    UNKNOWN,
}

@JsonClass(generateAdapter = true)
data class PlaceBallotRace(
    val type: BallotRaceType,
    val title: String,
    /** Offices: candidate names (order randomized, as on the ballot). */
    val candidates: List<String> = emptyList(),
    /** Measures: plain-language summary. */
    val summary: String? = null,
)

@JsonClass(generateAdapter = true)
data class PlacePollingPlace(
    /** e.g. "Vote by mail · Oregon". */
    val name: String,
    val detail: String,
    @Json(name = "vote_by_mail") val voteByMail: Boolean,
)

/**
 * Launch layer #8 (seasonal half) — Civic election. Off-season this
 * section is `unavailable` while districts stay ready.
 */
@JsonClass(generateAdapter = true)
data class PlaceCivicElectionData(
    val name: String,
    /** ISO 8601. */
    val date: String,
    @Json(name = "days_until") val daysUntil: Int,
    @Json(name = "polling_place") val pollingPlace: PlacePollingPlace? = null,
    /** Ballot races; may be empty (summary only) on the dashboard. */
    val ballot: List<PlaceBallotRace> = emptyList(),
)

// ─── Band-B payload (Your Home) ──────────────────────────────

/**
 * Your Home — property facts + value estimate + assessment (Band B,
 * ATTOM-paid record). Gated to T3+ and only populated when the ATTOM
 * key is configured; otherwise the section renders `unavailable`.
 */
@JsonClass(generateAdapter = true)
data class PlaceYourHomeData(
    @Json(name = "year_built") val yearBuilt: Int? = null,
    val sqft: Int? = null,
    val bedrooms: Int? = null,
    val bathrooms: Double? = null,
    @Json(name = "lot_sqft") val lotSqft: Int? = null,
    @Json(name = "home_type") val homeType: String? = null,
    @Json(name = "estimated_value") val estimatedValue: Double? = null,
    @Json(name = "value_low") val valueLow: Double? = null,
    @Json(name = "value_high") val valueHigh: Double? = null,
    @Json(name = "assessed_value") val assessedValue: Double? = null,
)

// ─── Section payload union ───────────────────────────────────

/** Typed payload for a section envelope — one case per launch-set id. */
sealed interface PlaceSectionData {
    data class Weather(val value: PlaceWeatherData) : PlaceSectionData

    data class AirQuality(val value: PlaceAirQualityData) : PlaceSectionData

    data class Alerts(val value: PlaceAlertsData) : PlaceSectionData

    data class SunriseSunset(val value: PlaceSunriseSunsetData) : PlaceSectionData

    data class YourHome(val value: PlaceYourHomeData) : PlaceSectionData

    data class Flood(val value: PlaceFloodData) : PlaceSectionData

    data class Seismic(val value: PlaceSeismicData) : PlaceSectionData

    data class Wildfire(val value: PlaceWildfireData) : PlaceSectionData

    data class LeadRadon(val value: PlaceLeadRadonData) : PlaceSectionData

    data class DrinkingWater(val value: PlaceDrinkingWaterData) : PlaceSectionData

    data class EnvironmentalHazards(val value: PlaceEnvironmentalHazardsData) : PlaceSectionData

    data class BlockDensity(val value: PlaceBlockDensityData) : PlaceSectionData

    data class CensusContext(val value: PlaceCensusContextData) : PlaceSectionData

    data class BillBenchmark(val value: PlaceBillBenchmarkData) : PlaceSectionData

    data class Incentives(val value: PlaceIncentivesData) : PlaceSectionData

    data class RentBand(val value: PlaceRentBandData) : PlaceSectionData

    data class CivicDistricts(val value: PlaceCivicDistrictsData) : PlaceSectionData

    data class CivicElection(val value: PlaceCivicElectionData) : PlaceSectionData
}

// ─── The envelope ────────────────────────────────────────────

/**
 * The section envelope — the contract atom. One per section. Decoded by
 * the hand-written [PlaceSectionEnvelopeAdapterFactory] (the payload
 * type depends on the sibling `id` field, which Moshi's polymorphic
 * factory can't express).
 *
 * `data` is non-null only when `access` allows it AND `status` is one
 * of READY/PARTIAL/STALE; it is null for unavailable/error, for locked
 * sections, for UNKNOWN section ids, and when the payload itself fails
 * to decode (that one section degrades; the response survives).
 */
data class PlaceSectionEnvelope(
    /** Raw wire id — preserved even for ids this build doesn't know. */
    val id: String,
    val group: String,
    val band: PlaceBand,
    val access: PlaceSectionAccess,
    val status: PlaceSectionStatus,
    /** ISO 8601 timestamp of the underlying data. */
    val asOf: String?,
    /** Provider label, e.g. "FEMA National Flood Hazard Layer". */
    val source: String?,
    val coverage: PlaceCoverage,
    /** Why there is no data — a coverage gap or a lock reason. */
    val unavailableReason: String?,
    val data: PlaceSectionData?,
) {
    val sectionId: PlaceSectionId get() = PlaceSectionId.from(id)
    val groupId: PlaceGroup get() = PlaceGroup.from(group)

    val weather: PlaceWeatherData? get() = (data as? PlaceSectionData.Weather)?.value
    val airQuality: PlaceAirQualityData? get() = (data as? PlaceSectionData.AirQuality)?.value
    val alerts: PlaceAlertsData? get() = (data as? PlaceSectionData.Alerts)?.value
    val sunriseSunset: PlaceSunriseSunsetData? get() = (data as? PlaceSectionData.SunriseSunset)?.value
    val yourHome: PlaceYourHomeData? get() = (data as? PlaceSectionData.YourHome)?.value
    val flood: PlaceFloodData? get() = (data as? PlaceSectionData.Flood)?.value
    val seismic: PlaceSeismicData? get() = (data as? PlaceSectionData.Seismic)?.value
    val wildfire: PlaceWildfireData? get() = (data as? PlaceSectionData.Wildfire)?.value
    val leadRadon: PlaceLeadRadonData? get() = (data as? PlaceSectionData.LeadRadon)?.value
    val drinkingWater: PlaceDrinkingWaterData? get() = (data as? PlaceSectionData.DrinkingWater)?.value
    val environmentalHazards: PlaceEnvironmentalHazardsData?
        get() = (data as? PlaceSectionData.EnvironmentalHazards)?.value
    val blockDensity: PlaceBlockDensityData? get() = (data as? PlaceSectionData.BlockDensity)?.value
    val censusContext: PlaceCensusContextData? get() = (data as? PlaceSectionData.CensusContext)?.value
    val billBenchmark: PlaceBillBenchmarkData? get() = (data as? PlaceSectionData.BillBenchmark)?.value
    val incentives: PlaceIncentivesData? get() = (data as? PlaceSectionData.Incentives)?.value
    val rentBand: PlaceRentBandData? get() = (data as? PlaceSectionData.RentBand)?.value
    val civicDistricts: PlaceCivicDistrictsData? get() = (data as? PlaceSectionData.CivicDistricts)?.value
    val civicElection: PlaceCivicElectionData? get() = (data as? PlaceSectionData.CivicElection)?.value
}

// ─── Response root ───────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class PlaceAddressRef(
    /** Display label, e.g. "1421 SE Oak St, Portland". */
    val label: String,
    val line1: String,
    val city: String,
    val state: String,
    @Json(name = "postal_code") val postalCode: String? = null,
)

@JsonClass(generateAdapter = true)
data class PlaceGroupBlock(
    val group: String,
    /** Server-rendered group label, e.g. "Risk & readiness". */
    val label: String,
    val sections: List<PlaceSectionEnvelope> = emptyList(),
) {
    val groupId: PlaceGroup get() = PlaceGroup.from(group)
}

/**
 * `GET /api/homes/:id/intelligence` — grouped section envelopes for an
 * address. `regionSupported = false` drives the "coming to your region"
 * state for non-US addresses.
 */
@JsonClass(generateAdapter = true)
data class PlaceIntelligence(
    val place: PlaceAddressRef,
    val tier: PlaceTier,
    @Json(name = "region_supported") val regionSupported: Boolean,
    /** ISO 8601. */
    @Json(name = "generated_at") val generatedAt: String,
    val groups: List<PlaceGroupBlock> = emptyList(),
)

// ─── Anonymous T0 preview (`GET /api/public/place`) ──────────

/**
 * The preview endpoint does NOT return the full envelope. It returns a
 * deliberately small, sanitized shape (the §4 anti-leak rule): only the
 * free Band-A subset live (flood, density bucket, area teaser) plus
 * locked descriptors for everything recurring/exact, so the client can
 * render the locked cards + the soft wall.
 */
enum class PlacePreviewStatus {
    @Json(name = "ready")
    READY,

    @Json(name = "partial")
    PARTIAL,

    @Json(name = "unsupported_region")
    UNSUPPORTED_REGION,
    UNKNOWN,
}

/** ready / unavailable for the free preview mini-sections. */
enum class PlacePreviewSectionStatus {
    @Json(name = "ready")
    READY,

    @Json(name = "unavailable")
    UNAVAILABLE,
}

@JsonClass(generateAdapter = true)
data class PlacePreviewFlood(
    val status: PlacePreviewSectionStatus,
    val zone: String? = null,
    val description: String? = null,
    val source: String,
)

@JsonClass(generateAdapter = true)
data class PlacePreviewDensity(
    val status: PlacePreviewSectionStatus,
    /** k-anon bucket only — never a count (§4.1). */
    val bucket: PlaceDensityBucket,
    val label: String,
    val source: String,
)

@JsonClass(generateAdapter = true)
data class PlacePreviewArea(
    val status: PlacePreviewSectionStatus,
    @Json(name = "median_year_built") val medianYearBuilt: Int? = null,
    @Json(name = "median_home_value") val medianHomeValue: Double? = null,
    val note: String,
    val source: String,
)

/** What tier opens a locked preview section: account = T1, claim = T3. */
enum class PlacePreviewUnlock {
    @Json(name = "account")
    ACCOUNT,

    @Json(name = "claim")
    CLAIM,
    UNKNOWN,
}

/** A gated section descriptor — drives a LockedCard + the soft wall. */
@JsonClass(generateAdapter = true)
data class PlacePreviewLockedSection(
    val id: String,
    val group: String,
    val title: String,
    val band: PlaceBand,
    val unlock: PlacePreviewUnlock,
    val reason: String,
) {
    val groupId: PlaceGroup get() = PlaceGroup.from(group)
}

/** Sanitized area-level place identity (no exact coords). */
@JsonClass(generateAdapter = true)
data class PlacePreviewPlaceRef(
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
)

/** The free demonstration subset (present on ready/partial). */
@JsonClass(generateAdapter = true)
data class PlacePreviewFree(
    val flood: PlacePreviewFlood,
    val density: PlacePreviewDensity,
    val area: PlacePreviewArea,
)

/**
 * `GET /api/public/place?address=` — the anonymous, address-only
 * preview. Non-persistent (no DB writes): close and reopen still hits
 * the wall.
 */
@JsonClass(generateAdapter = true)
data class PlacePreview(
    val status: PlacePreviewStatus,
    /** Always "preview". */
    val tier: String,
    /** "US" or null (null on unsupported region). */
    val region: String? = null,
    /** Present on UNSUPPORTED_REGION. */
    val message: String? = null,
    val place: PlacePreviewPlaceRef? = null,
    val free: PlacePreviewFree? = null,
    val locked: List<PlacePreviewLockedSection>? = null,
    val disclaimer: String? = null,
)
