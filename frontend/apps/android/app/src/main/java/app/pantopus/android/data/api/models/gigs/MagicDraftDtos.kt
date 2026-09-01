@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Optional context block for `POST /api/gigs/magic-draft`. All fields are
 * nullable so Moshi omits them when unset.
 */
@JsonClass(generateAdapter = true)
data class MagicDraftContext(
    val latitude: Double? = null,
    val longitude: Double? = null,
    val budget: Double? = null,
)

/** Body for `POST /api/gigs/magic-draft`. `text` must be 3–2000 chars. */
@JsonClass(generateAdapter = true)
data class MagicDraftRequest(
    val text: String,
    val context: MagicDraftContext? = null,
    val attachmentUrls: List<String>? = null,
)

/** Nested `budget_range` on a magic draft. */
@JsonClass(generateAdapter = true)
data class MagicDraftBudgetRange(
    val min: Double? = null,
    val max: Double? = null,
)

/**
 * The structured draft the backend NLP extracts from the describe text.
 * Every field is nullable — the parser only emits what it's confident
 * about, and unknown keys are tolerated (Moshi skips them by default).
 *
 * A12.8 — extended with the archetype module objects + power fields so
 * the Fill-gaps step can prefill from the parse and the same shape can
 * ride back out on `POST /api/gigs/magic-post` (`draft` body key,
 * `backend/routes/magicTask.js:397`).
 */
@JsonClass(generateAdapter = true)
data class MagicDraftDto(
    val title: String? = null,
    val description: String? = null,
    val category: String? = null,
    @Json(name = "task_archetype") val taskArchetype: String? = null,
    /** "offers" | "fixed" | "hourly". */
    @Json(name = "pay_type") val payType: String? = null,
    @Json(name = "budget_fixed") val budgetFixed: Double? = null,
    @Json(name = "hourly_rate") val hourlyRate: Double? = null,
    @Json(name = "estimated_hours") val estimatedHours: Double? = null,
    @Json(name = "budget_range") val budgetRange: MagicDraftBudgetRange? = null,
    /** "asap" | "today" | "scheduled" | "flexible". */
    @Json(name = "schedule_type") val scheduleType: String? = null,
    @Json(name = "time_window_start") val timeWindowStart: String? = null,
    @Json(name = "time_window_end") val timeWindowEnd: String? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
    @Json(name = "privacy_level") val privacyLevel: String? = null,
    val tags: List<String>? = null,
    @Json(name = "is_urgent") val isUrgent: Boolean? = null,
    val attachments: List<String>? = null,
    @Json(name = "attachments_suggested") val attachmentsSuggested: Boolean? = null,
    /** delivery_errand shopping list (camelCase inside, ≤20). */
    val items: List<MagicTaskItemDto>? = null,
    @Json(name = "special_instructions") val specialInstructions: String? = null,
    @Json(name = "access_notes") val accessNotes: String? = null,
    @Json(name = "required_tools") val requiredTools: List<String>? = null,
    @Json(name = "language_preference") val languagePreference: String? = null,
    /** "flexible" | "standard" | "strict". */
    @Json(name = "cancellation_policy") val cancellationPolicy: String? = null,
    @Json(name = "starts_asap") val startsAsap: Boolean? = null,
    @Json(name = "response_window_minutes") val responseWindowMinutes: Int? = null,
    // Archetype module objects (`backend/utils/moduleSchemas.js`) —
    // snake_case keys, camelCase fields INSIDE each object.
    @Json(name = "care_details") val careDetails: CareDetailsDto? = null,
    @Json(name = "logistics_details") val logisticsDetails: LogisticsDetailsDto? = null,
    @Json(name = "remote_details") val remoteDetails: RemoteDetailsDto? = null,
    @Json(name = "urgent_details") val urgentDetails: UrgentDetailsDto? = null,
    @Json(name = "event_details") val eventDetails: EventDetailsDto? = null,
    // delivery_errand + pro_service_quote module fields. These are FLAT
    // gig columns, not JSONB (`backend/routes/gigs.js:481-486` and
    // `:499-505`); `magicTaskService.js:460-480` normalises the AI's
    // `pickup_location_text` into `pickup_address` so the Fill-gaps step
    // can prefill both editors.
    @Json(name = "pickup_address") val pickupAddress: String? = null,
    @Json(name = "pickup_notes") val pickupNotes: String? = null,
    @Json(name = "dropoff_address") val dropoffAddress: String? = null,
    @Json(name = "dropoff_notes") val dropoffNotes: String? = null,
    @Json(name = "delivery_proof_required") val deliveryProofRequired: Boolean? = null,
    @Json(name = "requires_license") val requiresLicense: Boolean? = null,
    @Json(name = "license_type") val licenseType: String? = null,
    @Json(name = "requires_insurance") val requiresInsurance: Boolean? = null,
    @Json(name = "scope_description") val scopeDescription: String? = null,
    @Json(name = "deposit_required") val depositRequired: Boolean? = null,
    @Json(name = "deposit_amount") val depositAmount: Double? = null,
)

/** One delivery-errand list item. Fields are camelCase on the wire. */
@JsonClass(generateAdapter = true)
data class MagicTaskItemDto(
    val name: String,
    val notes: String? = null,
    val budgetCap: Double? = null,
    val preferredStore: String? = null,
)

/** care_task module — `careDetailsSchema`. */
@JsonClass(generateAdapter = true)
data class CareDetailsDto(
    /** "child" | "pet" | "elder" | "other". */
    val careType: String? = null,
    val agesOrDetails: String? = null,
    val count: Int? = null,
    val specialNeeds: String? = null,
    val languagePreference: String? = null,
    val emergencyNotes: String? = null,
)

/** home_service / quick_help module — `logisticsDetailsSchema`. */
@JsonClass(generateAdapter = true)
data class LogisticsDetailsDto(
    val workerCount: Int? = null,
    val vehicleNeeded: Boolean? = null,
    val vehicleType: String? = null,
    val toolsNeeded: List<String>? = null,
    val accessInstructions: String? = null,
    val petsOnProperty: Boolean? = null,
    /** "none" | "few_steps" | "multiple_flights". */
    val stairsInfo: String? = null,
    val heavyLifting: Boolean? = null,
)

/** remote_task module — `remoteDetailsSchema`. */
@JsonClass(generateAdapter = true)
data class RemoteDetailsDto(
    /** "document" | "design" | "code" | "video" | "other". */
    val deliverableType: String? = null,
    val fileFormat: String? = null,
    val revisionCount: Int? = null,
    val timezone: String? = null,
    val meetingRequired: Boolean? = null,
    val dueDate: String? = null,
)

/** is_urgent module — `urgentDetailsSchema`. */
@JsonClass(generateAdapter = true)
data class UrgentDetailsDto(
    val startsAsap: Boolean? = null,
    val responseWindowMinutes: Int? = null,
    val arrivalNeededBy: String? = null,
    val shareLocationDuringTask: Boolean? = null,
    val liveStatusEnabled: Boolean? = null,
    val roadsideVehicleNotes: String? = null,
    val pickupDropoffMode: String? = null,
)

/** event_shift module — `eventDetailsSchema`. */
@JsonClass(generateAdapter = true)
data class EventDetailsDto(
    /** "party" | "wedding" | "corporate" | "community" | "other". */
    val eventType: String? = null,
    val guestCount: Int? = null,
    val shiftStart: String? = null,
    val shiftEnd: String? = null,
    val dressCode: String? = null,
    /** "setup" | "serving" | "bartending" | "cleanup" | "general". */
    val roleType: String? = null,
    val venueDetails: String? = null,
)

/** Envelope from `POST /api/gigs/magic-draft`. */
@JsonClass(generateAdapter = true)
data class MagicDraftResponse(
    val draft: MagicDraftDto,
    val confidence: Double? = null,
    val fieldConfidence: Map<String, Double>? = null,
    val clarifyingQuestion: String? = null,
    val source: String? = null,
    val elapsed: Long? = null,
    @Json(name = "_fallback") val fallback: Boolean? = null,
)
