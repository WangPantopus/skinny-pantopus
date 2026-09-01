package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Home Record Watch's rate-watch half (Wave 2b): the loan-month PMMS
 * baseline vs the current weekly average. Averages and deltas only —
 * copy never says "refinance". The deed/lien half is deliberately not
 * built (ATTOM recorder contract pending). Parity: iOS
 * `RecordWatchDTOs.swift`.
 */
@JsonClass(generateAdapter = true)
data class RecordWatchEvaluation(
    @Json(name = "baseline_rate") val baselineRate: Double,
    @Json(name = "current_rate") val currentRate: Double,
    @Json(name = "current_as_of") val currentAsOf: String,
    /** current − baseline, in percentage points (negative = below). */
    @Json(name = "delta_pp") val deltaPp: Double,
    @Json(name = "refi_window") val refiWindow: Boolean,
)

@JsonClass(generateAdapter = true)
data class RecordWatch(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    /** "YYYY-MM" as entered. */
    @Json(name = "loan_recorded_month") val loanRecordedMonth: String,
    @Json(name = "baseline_rate") val baselineRate: Double,
    @Json(name = "created_at") val createdAt: String,
    /** Null when the rate history is temporarily unreachable. */
    val evaluation: RecordWatchEvaluation? = null,
)

@JsonClass(generateAdapter = true)
data class SetRecordWatchRequest(
    @Json(name = "loan_recorded_month") val loanRecordedMonth: String,
)

@JsonClass(generateAdapter = true)
data class RecordWatchResponse(
    /** Null on GET when no watch exists. */
    val watch: RecordWatch? = null,
)

@JsonClass(generateAdapter = true)
data class RemoveRecordWatchResponse(
    val removed: Boolean = false,
)
