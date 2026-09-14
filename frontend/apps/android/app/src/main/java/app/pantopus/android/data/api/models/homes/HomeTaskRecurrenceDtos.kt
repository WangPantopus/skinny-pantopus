package app.pantopus.android.data.api.models.homes

import app.pantopus.android.data.homes.homeTaskUUID
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant
import java.time.ZoneId

internal const val MAX_RECURRENCE_REVISION = 999_999_999_999_999L
internal val RECURRENCE_FREQUENCIES = setOf("DAILY", "WEEKLY", "MONTHLY")

internal fun recurrenceDate(value: String?): Instant? = value?.let { runCatching { Instant.parse(it) }.getOrNull() }

internal fun recurrenceZone(value: String?): Boolean = value != null && (value == "UTC" || value in ZoneId.getAvailableZoneIds())

@JsonClass(generateAdapter = true)
data class HomeTaskAutomaticRecurrence(
    val state: String,
    val frequency: String,
    val interval: Int,
    val timezone: String,
    @Json(name = "next_due_at") val nextDueAt: String? = null,
) {
    fun valid(): Boolean =
        state in setOf("active", "paused", "needs_review") && frequency in RECURRENCE_FREQUENCIES &&
            interval in 1..365 && recurrenceZone(timezone) &&
            (if (state == "active") recurrenceDate(nextDueAt) != null else nextDueAt == null)

    fun label(): String =
        when (state) {
            "active" -> "Repeats every $interval ${recurrencePeriod(frequency)}${if (interval == 1) "" else "s"}"
            "paused" -> "Repeats paused"
            else -> "Repeats need review"
        }
}

internal fun recurrencePeriod(frequency: String): String =
    when (frequency) {
        "DAILY" -> "day"
        "WEEKLY" -> "week"
        else -> "month"
    }

@JsonClass(generateAdapter = true)
data class HomeTaskRecurrenceConfiguration(
    val id: String,
    val revision: Long,
    val state: String,
    val frequency: String,
    val interval: Int,
    val timezone: String,
    @Json(name = "anchor_at") val anchorAt: String,
    @Json(name = "generated_count") val generatedCount: Long,
    val reason: String? = null,
    @Json(name = "next_due_at") val nextDueAt: String? = null,
    @Json(name = "last_due_at") val lastDueAt: String? = null,
    @Json(name = "last_task_id") val lastTaskId: String? = null,
) {
    fun valid(): Boolean =
        homeTaskUUID(id) && revision in 1..MAX_RECURRENCE_REVISION && generatedCount >= 0 &&
            recurrenceDate(anchorAt) != null && (lastDueAt == null || recurrenceDate(lastDueAt) != null) &&
            (lastTaskId == null || homeTaskUUID(lastTaskId)) &&
            HomeTaskAutomaticRecurrence(state, frequency, interval, timezone, nextDueAt).valid()
}

/** GET and POST share the current projection; only POST adds its original receipt. */
@JsonClass(generateAdapter = true)
data class HomeTaskRecurrenceState(
    val ok: Boolean,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_id") val taskId: String,
    @Json(name = "can_manage") val canManage: Boolean,
    @Json(name = "task_updated_at") val taskUpdatedAt: String,
    val revision: Long,
    @Json(name = "task_session") val taskSession: HomeTaskSessionDto,
    val configuration: HomeTaskRecurrenceConfiguration? = null,
    val receipt: HomeTaskRecurrenceReceipt? = null,
    val replayed: Boolean? = null,
) {
    fun matches(
        home: String,
        task: String,
    ): Boolean =
        ok && homeId == home && taskId == task && recurrenceDate(taskUpdatedAt) != null &&
            revision in 0..MAX_RECURRENCE_REVISION &&
            (configuration?.let { it.valid() && it.revision == revision } ?: (revision == 0L))
}

/** This is the exact immutable wire command. Null start-only fields are omitted. */
@JsonClass(generateAdapter = true)
data class HomeTaskRecurrenceRequest(
    @Json(name = "request_id") val requestId: String,
    val action: String,
    @Json(name = "expected_revision") val expectedRevision: Long,
    @Json(name = "expected_task_updated_at") val expectedTaskUpdatedAt: String? = null,
    val frequency: String? = null,
    val interval: Int? = null,
    val timezone: String? = null,
) {
    fun valid(): Boolean {
        if (!homeTaskUUID(requestId) || expectedRevision !in 0..MAX_RECURRENCE_REVISION) return false
        if (action == "pause") return expectedTaskUpdatedAt == null && frequency == null && interval == null && timezone == null
        return action == "start" && recurrenceDate(expectedTaskUpdatedAt) != null && frequency in RECURRENCE_FREQUENCIES &&
            interval != null && interval in 1..365 && recurrenceZone(timezone)
    }
}

@JsonClass(generateAdapter = true)
data class HomeTaskRecurrenceReceipt(
    @Json(name = "request_id") val requestId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_id") val taskId: String,
    val action: String,
    val revision: Long,
    @Json(name = "request_hash") val requestHash: String,
    @Json(name = "created_at") val createdAt: String,
) {
    fun matches(request: HomeTaskRecurrenceRequest): Boolean {
        val expected = request.expectedRevision + if (request.action == "start" || request.expectedRevision > 0) 1 else 0
        return requestId == request.requestId && action == request.action && revision == expected &&
            requestHash.matches(Regex("^[a-f0-9]{64}$")) && recurrenceDate(createdAt) != null
    }
}
