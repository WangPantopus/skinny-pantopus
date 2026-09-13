@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import java.time.OffsetDateTime
import kotlin.math.roundToInt

/** A decoded object is not yet a trustworthy card or mutation confirmation. */
internal object HomeIntelligenceValidation {
    private val dimensions =
        mapOf("maintenance" to 25, "bills" to 20, "seasonal" to 20, "emergency" to 15, "household" to 10, "documents" to 10)
    private val destinations = setOf("maintenance", "bills", "dashboard", "emergency", "members", "documents")
    private val statuses = setOf("pending", "completed", "skipped", "hired")
    private val sources = setOf("cache", "cache_stale", "attom", "fallback", "unavailable")

    fun health(
        value: HomeHealthScoreDto,
        homeId: String,
    ): Boolean {
        if (!healthDimensions(value) || value.topIssue?.isBlank() == true) return false
        val action = value.topAction ?: return true
        return action.type == "navigate" && action.label.isNotBlank() && destinations.any { action.route == "/homes/$homeId/$it" }
    }

    private fun healthDimensions(value: HomeHealthScoreDto): Boolean {
        if (value.breakdown.keys != dimensions.keys || value.score !in 0..100) return false
        if (!value.breakdown.all {
                    (key, part) ->
                part.max == dimensions[key] && part.score in 0..part.max && part.issues.all { it.isNotBlank() }
            }
        ) {
            return false
        }
        return value.score == value.breakdown.values.sumOf { it.score }
    }

    fun checklist(
        value: SeasonalChecklistDto,
        homeId: String,
    ): Boolean {
        if (!checklistRows(value, homeId)) return false
        val all = value.items + value.carryover?.items.orEmpty()
        if (all.map { it.id }.distinct().size != all.size) return false
        val completed = value.items.count { it.isResolved }
        val percentage = if (value.items.isEmpty()) 0 else (100.0 * completed / value.items.size).roundToInt()
        return value.progress.total == value.items.size && value.progress.completed == completed && value.progress.percentage == percentage
    }

    private fun checklistRows(
        value: SeasonalChecklistDto,
        homeId: String,
    ): Boolean {
        if (value.season.key.isBlank() || value.season.label.isBlank()) return false
        if (!value.items.all { item(it, homeId) && it.seasonKey == value.season.key }) return false
        val carryover = value.carryover
        if (carryover != null) {
            return carryover.season.key.isNotBlank() && carryover.season.label.isNotBlank() &&
                carryover.items.all { item(it, homeId) && it.seasonKey == carryover.season.key && it.status == "pending" }
        }
        return true
    }

    fun item(
        value: SeasonalChecklistItemDto,
        homeId: String,
    ): Boolean =
        value.homeId == homeId && value.id.isNotBlank() && value.title.isNotBlank() &&
            !value.seasonKey.isNullOrBlank() && value.year?.let { it in 1..9999 } == true && !value.itemKey.isNullOrBlank() &&
            value.status in statuses && value.sortOrder >= 0 && timestamp(value.completedAt) &&
            (value.status != "hired" || !value.gigId.isNullOrBlank())

    fun property(value: HomePropertyValueDto): Boolean {
        if (!listOf(
                value.estimatedValue,
                value.valueRangeLow,
                value.valueRangeHigh,
            ).all { it == null || it.isFinite() && it > 0 }
        ) {
            return false
        }
        return propertyMetadata(value) && propertyRange(value)
    }

    private fun propertyMetadata(value: HomePropertyValueDto): Boolean {
        if (value.source !in sources || !timestamp(value.lastUpdated)) return false
        if (value.valueConfidence?.let { !it.isFinite() || it !in 0.0..100.0 } == true) return false
        if (value.zipMedianSalePriceTrend?.let { it !in setOf("up", "down", "flat") } == true) return false
        return value.yearBuilt?.let { it in 1..9999 } != false && value.sqft?.let { it > 0 } != false
    }

    private fun propertyRange(value: HomePropertyValueDto): Boolean {
        val estimate = value.estimatedValue
        val low = value.valueRangeLow
        val high = value.valueRangeHigh
        if (value.source == "unavailable" && listOf(estimate, low, high, value.valueConfidence).any { it != null }) return false
        if (low != null && high != null && low > high) return false
        if (estimate != null && low != null && estimate < low) return false
        return estimate == null || high == null || estimate <= high
    }

    private fun timestamp(value: String?): Boolean = value == null || runCatching { OffsetDateTime.parse(value) }.isSuccess
}
