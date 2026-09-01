@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.shared.activity_filter_sheet

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSection
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetShell
import java.time.Instant
import java.time.ZoneId

/**
 * P5.4 — Generic activity filter. One sheet for bids / posts / tasks /
 * offers: they share the same filter shape (status chips + sort order +
 * date range). A thin, semantic builder on top of the shared
 * [FilterSheetShell] — mirrors the iOS `ActivityFilterSheet`.
 *
 * Per-surface parameterisation is the [statusOptions] (and its title);
 * sort + date range are shared across every surface.
 */

/** Sort order shared by every activity surface. */
enum class ActivitySortOrder(
    val id: String,
    val label: String,
) {
    Newest("newest", "Newest first"),
    Oldest("oldest", "Oldest first"),
    ValueHighToLow("valueHighToLow", "Value: high to low"),
    ValueLowToHigh("valueLowToHigh", "Value: low to high"),
    ;

    companion object {
        /** Full set — surfaces with a per-row value (bids / tasks / offers). */
        val ALL = listOf(Newest, Oldest, ValueHighToLow, ValueLowToHigh)

        /** Date-only subset — surfaces without a value (My posts). */
        val TIME_ONLY = listOf(Newest, Oldest)

        fun fromId(id: String?): ActivitySortOrder? = entries.firstOrNull { it.id == id }
    }
}

/**
 * Date-range preset shared by every activity surface. [Anytime] is the
 * no-filter position. (A bespoke "custom" picker is intentionally
 * deferred — the shared shell hosts chips, not date pickers.)
 */
enum class ActivityDateRange(
    val id: String,
    val label: String,
) {
    Anytime("anytime", "Anytime"),
    Today("today", "Today"),
    Week("week", "This week"),
    Month("month", "This month"),
    ;

    /** Whether [date] falls inside this range relative to [now]. */
    fun contains(
        date: Instant,
        now: Instant,
        zone: ZoneId = ZoneId.systemDefault(),
    ): Boolean =
        when (this) {
            Anytime -> true
            Today -> date.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate()
            Week -> !date.isBefore(now.minusSeconds(7L * 86_400))
            Month -> !date.isBefore(now.minusSeconds(30L * 86_400))
        }

    companion object {
        val ALL = listOf(Anytime, Today, Week, Month)

        fun fromId(id: String?): ActivityDateRange = entries.firstOrNull { it.id == id } ?: Anytime
    }
}

/**
 * The applied (or working) selection across the three filter dimensions.
 * The default value is the "no filter" position — [isActive] is `false`
 * so consumers can skip filtering and preserve the unfiltered order.
 */
@Immutable
data class ActivityFilter(
    /** Selected status chip ids. Empty = all statuses. */
    val statusIds: Set<String> = emptySet(),
    /** Selected sort order. `null` = keep the list's natural order. */
    val sort: ActivitySortOrder? = null,
    /** Selected date-range preset. [ActivityDateRange.Anytime] = no filter. */
    val dateRange: ActivityDateRange = ActivityDateRange.Anytime,
) {
    /** `true` when the user has narrowed or re-ordered the list. */
    val isActive: Boolean
        get() = statusIds.isNotEmpty() || sort != null || dateRange != ActivityDateRange.Anytime

    /**
     * Apply this filter to [items]. [statusId] projects each element's
     * status chip id (return `null` for "no matching chip"); [date] and
     * [value] project the sort/date keys. Returns [items] untouched when
     * the filter is inactive.
     */
    fun <T> apply(
        items: List<T>,
        now: Instant,
        statusId: (T) -> String?,
        date: (T) -> Instant?,
        value: (T) -> Double?,
    ): List<T> {
        if (!isActive) return items
        var result = items
        if (statusIds.isNotEmpty()) {
            result = result.filter { statusId(it)?.let(statusIds::contains) == true }
        }
        if (dateRange != ActivityDateRange.Anytime) {
            result = result.filter { element -> date(element)?.let { dateRange.contains(it, now) } == true }
        }
        result =
            when (sort) {
                ActivitySortOrder.Newest -> result.sortedByDescending { date(it) ?: Instant.MIN }
                ActivitySortOrder.Oldest -> result.sortedBy { date(it) ?: Instant.MAX }
                ActivitySortOrder.ValueHighToLow -> result.sortedByDescending { value(it) ?: -Double.MAX_VALUE }
                ActivitySortOrder.ValueLowToHigh -> result.sortedBy { value(it) ?: Double.MAX_VALUE }
                null -> result
            }
        return result
    }
}

/** Stable section ids shared with the iOS counterpart. */
object ActivityFilterSectionId {
    const val STATUS = "status"
    const val SORT = "sort"
    const val DATE_RANGE = "dateRange"
}

/** Build the shell's section list from an [ActivityFilter]. */
fun activityFilterSections(
    statusTitle: String,
    statusOptions: List<FilterOption>,
    sortOptions: List<ActivitySortOrder>,
    filter: ActivityFilter,
): List<FilterSection> {
    val sections = mutableListOf<FilterSection>()
    if (statusOptions.isNotEmpty()) {
        sections.add(
            FilterSection(
                id = ActivityFilterSectionId.STATUS,
                title = statusTitle,
                control = FilterControl.ChipGroup(options = statusOptions, selectedIds = filter.statusIds),
            ),
        )
    }
    sections.add(
        FilterSection(
            id = ActivityFilterSectionId.SORT,
            title = "Sort by",
            control =
                FilterControl.Radio(
                    options = sortOptions.map { FilterOption(id = it.id, label = it.label) },
                    selectedId = filter.sort?.id,
                ),
        ),
    )
    sections.add(
        FilterSection(
            id = ActivityFilterSectionId.DATE_RANGE,
            title = "Date range",
            control =
                FilterControl.SingleChip(
                    options = ActivityDateRange.ALL.map { FilterOption(id = it.id, label = it.label) },
                    selectedId = filter.dateRange.id,
                ),
        ),
    )
    return sections
}

/** Parse the shell's applied sections back into an [ActivityFilter]. */
fun activityFilterFrom(sections: List<FilterSection>): ActivityFilter {
    var statusIds: Set<String> = emptySet()
    var sort: ActivitySortOrder? = null
    var dateRange = ActivityDateRange.Anytime
    sections.forEach { section ->
        when (section.id) {
            ActivityFilterSectionId.STATUS ->
                (section.control as? FilterControl.ChipGroup)?.let { statusIds = it.selectedIds }
            ActivityFilterSectionId.SORT ->
                (section.control as? FilterControl.Radio)?.let { sort = ActivitySortOrder.fromId(it.selectedId) }
            ActivityFilterSectionId.DATE_RANGE ->
                (section.control as? FilterControl.SingleChip)?.let { dateRange = ActivityDateRange.fromId(it.selectedId) }
        }
    }
    return ActivityFilter(statusIds = statusIds, sort = sort, dateRange = dateRange)
}

/**
 * The generic activity filter sheet. Builds three sections (status /
 * sort / date range) and renders them through [FilterSheetShell], then
 * maps the applied sections back to an [ActivityFilter].
 *
 * @param statusOptions Per-surface status chips. Pass an empty list to
 *     omit the status section entirely.
 * @param sortOptions Sort orders to offer. Surfaces without a per-row
 *     value pass [ActivitySortOrder.TIME_ONLY].
 * @param filter The currently-applied filter (seeds the working copy).
 * @param onApply Called with the parsed filter when the user taps Apply.
 * @param onDismiss Called when the sheet should dismiss.
 */
@Composable
fun ActivityFilterSheet(
    statusOptions: List<FilterOption>,
    filter: ActivityFilter,
    onApply: (ActivityFilter) -> Unit,
    onDismiss: () -> Unit,
    statusTitle: String = "Status",
    sortOptions: List<ActivitySortOrder> = ActivitySortOrder.ALL,
) {
    FilterSheetShell(
        sections =
            activityFilterSections(
                statusTitle = statusTitle,
                statusOptions = statusOptions,
                sortOptions = sortOptions,
                filter = filter,
            ),
        onApply = { applied -> onApply(activityFilterFrom(applied)) },
        onDismiss = onDismiss,
        title = "Filters",
    )
}
