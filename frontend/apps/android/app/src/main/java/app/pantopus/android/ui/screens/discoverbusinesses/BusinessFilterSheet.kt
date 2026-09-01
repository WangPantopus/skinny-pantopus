@file:Suppress("PackageNaming", "MagicNumber")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.discoverbusinesses

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSection
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetShell

/**
 * P5.2 — Business filters. The bottom sheet shown from the Discover
 * businesses' `sliders-horizontal` top-bar action. Built on the shared
 * [FilterSheetShell]; this file owns the typed ⇆ [FilterSection]
 * mapping. Mirrors iOS `BusinessFilterSheet`.
 *
 * All four dimensions map to `GET /api/businesses/search` query params
 * (`categories`, `radius_miles`, `open_now`, `rating_min`). The default
 * radius (5 mi) mirrors the backend's `SEARCH_DEFAULT_RADIUS_MILES`.
 */
@Immutable
data class DiscoverBusinessFilters(
    /** Selected coarse category ids. Empty = all categories. */
    val categories: Set<String> = emptySet(),
    /** Search radius in miles — one of [BusinessFilterStops.radius]. */
    val radiusMiles: Double = DEFAULT_RADIUS_MILES,
    /** Show only businesses open right now. */
    val openNow: Boolean = false,
    /** Minimum average rating, or `null` for "any". */
    val ratingFloor: Double? = null,
) {
    /** Number of active filter dimensions — drives the filter-count badge. */
    val activeCount: Int
        get() {
            var count = 0
            if (categories.isNotEmpty()) count++
            if (radiusMiles != DEFAULT_RADIUS_MILES) count++
            if (openNow) count++
            if (ratingFloor != null) count++
            return count
        }

    companion object {
        /** Backend default radius (`SEARCH_DEFAULT_RADIUS_MILES`). */
        const val DEFAULT_RADIUS_MILES: Double = 5.0

        val Default = DiscoverBusinessFilters()
    }
}

/** One discrete distance stop. */
@Immutable
data class BusinessRadiusStop(val value: Double, val id: String, val label: String)

/** One rating-floor option. */
@Immutable
data class BusinessRatingStop(val value: Double?, val id: String, val label: String)

/** Static option tables shared by the sheet + its tests. */
object BusinessFilterStops {
    val categories: List<FilterOption> =
        listOf(
            FilterOption("home-services", "Home services"),
            FilterOption("food", "Food"),
            FilterOption("retail", "Retail"),
            FilterOption("wellness", "Wellness"),
            FilterOption("auto", "Auto"),
            FilterOption("pets", "Pets"),
            FilterOption("other", "Other"),
        )

    val radius: List<BusinessRadiusStop> =
        listOf(
            BusinessRadiusStop(0.5, "0.5", "0.5 mi"),
            BusinessRadiusStop(1.0, "1", "1 mi"),
            BusinessRadiusStop(3.0, "3", "3 mi"),
            BusinessRadiusStop(5.0, "5", "5 mi"),
            BusinessRadiusStop(10.0, "10", "10 mi"),
        )

    val rating: List<BusinessRatingStop> =
        listOf(
            BusinessRatingStop(null, "any", "Any"),
            BusinessRatingStop(3.0, "3", "3+ stars"),
            BusinessRatingStop(4.0, "4", "4+ stars"),
            BusinessRatingStop(4.5, "4.5", "4.5+ stars"),
        )

    val defaultRadiusIndex: Int
        get() =
            radius.indexOfFirst { it.value == DiscoverBusinessFilters.DEFAULT_RADIUS_MILES }
                .takeIf { it >= 0 } ?: (radius.size - 1).coerceAtLeast(0)

    fun radiusIndex(miles: Double): Int = radius.indexOfFirst { it.value == miles }.takeIf { it >= 0 } ?: defaultRadiusIndex
}

private object BusinessSectionId {
    const val CATEGORY = "category"
    const val DISTANCE = "distance"
    const val RATING = "rating"
    const val OPTIONS = "options"
}

private object BusinessOptionId {
    const val OPEN_NOW = "open-now"
}

/** Build render sections from a typed model. */
internal fun businessSections(filters: DiscoverBusinessFilters): List<FilterSection> {
    val ratingId = BusinessFilterStops.rating.firstOrNull { it.value == filters.ratingFloor }?.id ?: "any"
    val optionIds = buildSet { if (filters.openNow) add(BusinessOptionId.OPEN_NOW) }
    return listOf(
        FilterSection(
            id = BusinessSectionId.CATEGORY,
            title = "Category",
            control =
                FilterControl.ChipGroup(
                    options = BusinessFilterStops.categories,
                    selectedIds = filters.categories,
                ),
        ),
        FilterSection(
            id = BusinessSectionId.DISTANCE,
            title = "Distance",
            control =
                FilterControl.StepSlider(
                    stops = BusinessFilterStops.radius.map { FilterOption(it.id, it.label) },
                    selectedIndex = BusinessFilterStops.radiusIndex(filters.radiusMiles),
                    defaultIndex = BusinessFilterStops.defaultRadiusIndex,
                ),
        ),
        FilterSection(
            id = BusinessSectionId.RATING,
            title = "Rating",
            control =
                FilterControl.Radio(
                    options = BusinessFilterStops.rating.map { FilterOption(it.id, it.label) },
                    selectedId = ratingId,
                ),
        ),
        FilterSection(
            id = BusinessSectionId.OPTIONS,
            title = "Availability",
            control =
                FilterControl.Toggle(
                    options = listOf(FilterOption(BusinessOptionId.OPEN_NOW, "Open now")),
                    selectedIds = optionIds,
                ),
        ),
    )
}

/** Parse applied sections back into a typed model. */
internal fun businessFilters(sections: List<FilterSection>): DiscoverBusinessFilters {
    var result = DiscoverBusinessFilters.Default
    for (section in sections) {
        val control = section.control
        when {
            section.id == BusinessSectionId.CATEGORY && control is FilterControl.ChipGroup ->
                result = result.copy(categories = control.selectedIds)
            section.id == BusinessSectionId.DISTANCE && control is FilterControl.StepSlider ->
                BusinessFilterStops.radius.getOrNull(control.selectedIndex)?.let {
                    result = result.copy(radiusMiles = it.value)
                }
            section.id == BusinessSectionId.RATING && control is FilterControl.Radio ->
                result =
                    result.copy(
                        ratingFloor = BusinessFilterStops.rating.firstOrNull { it.id == control.selectedId }?.value,
                    )
            section.id == BusinessSectionId.OPTIONS && control is FilterControl.Toggle ->
                result = result.copy(openNow = control.selectedIds.contains(BusinessOptionId.OPEN_NOW))
        }
    }
    return result
}

/** Business filter bottom sheet. Host renders this when its sheet flag is on. */
@Composable
fun BusinessFilterSheet(
    initialFilters: DiscoverBusinessFilters,
    onApply: (DiscoverBusinessFilters) -> Unit,
    onDismiss: () -> Unit,
) {
    FilterSheetShell(
        sections = businessSections(initialFilters),
        onApply = { sections -> onApply(businessFilters(sections)) },
        onDismiss = onDismiss,
        title = "Filters",
    )
}
