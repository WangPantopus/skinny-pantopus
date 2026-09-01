@file:Suppress("PackageNaming", "MatchingDeclarationName")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.discoverhub

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSection
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetShell

/**
 * P5.2 — Discovery filters. The bottom sheet shown from the Discover
 * hub's `sliders-horizontal` top-bar action. Built on the shared
 * [FilterSheetShell]; this file owns the typed ⇆ [FilterSection]
 * mapping. Mirrors iOS `DiscoveryFilterSheet`.
 *
 * Distance radius is intentionally absent: `/api/hub/discovery` exposes
 * no radius parameter and items carry no per-item distance.
 */
@Immutable
data class DiscoverHubFilters(
    /** Selected content-type ids (`DiscoverHubSection.*`). Empty = all. */
    val contentTypes: Set<String> = emptySet(),
    /** Show only verified people/businesses. */
    val verifiedOnly: Boolean = false,
    /** Sort each section newest-first (by `createdAt`, client-side). */
    val newestFirst: Boolean = false,
) {
    /**
     * Number of active filter dimensions — drives the surface's
     * filter-count badge. A non-empty content-type selection counts as
     * one dimension regardless of how many chips are picked.
     */
    val activeCount: Int
        get() {
            var count = 0
            if (contentTypes.isNotEmpty()) count++
            if (verifiedOnly) count++
            if (newestFirst) count++
            return count
        }

    companion object {
        /** The "no filters" baseline (what Reset returns to). */
        val Default = DiscoverHubFilters()
    }
}

/** Stable section ids. */
private object DiscoverySectionId {
    const val CONTENT_TYPE = "contentType"
    const val OPTIONS = "options"
}

/** Stable toggle-option ids. */
private object DiscoveryOptionId {
    const val VERIFIED_ONLY = "verified-only"
    const val NEWEST_FIRST = "newest-first"
}

/** Build render sections from a typed model. */
internal fun discoverySections(filters: DiscoverHubFilters): List<FilterSection> {
    val optionIds =
        buildSet {
            if (filters.verifiedOnly) add(DiscoveryOptionId.VERIFIED_ONLY)
            if (filters.newestFirst) add(DiscoveryOptionId.NEWEST_FIRST)
        }
    return listOf(
        FilterSection(
            id = DiscoverySectionId.CONTENT_TYPE,
            title = "Content type",
            control =
                FilterControl.ChipGroup(
                    options =
                        listOf(
                            FilterOption(DiscoverHubSection.PEOPLE, "People"),
                            FilterOption(DiscoverHubSection.BUSINESSES, "Businesses"),
                            FilterOption(DiscoverHubSection.GIGS, "Gigs"),
                            FilterOption(DiscoverHubSection.LISTINGS, "Listings"),
                        ),
                    selectedIds = filters.contentTypes,
                ),
        ),
        FilterSection(
            id = DiscoverySectionId.OPTIONS,
            title = "Options",
            control =
                FilterControl.Toggle(
                    options =
                        listOf(
                            FilterOption(DiscoveryOptionId.VERIFIED_ONLY, "Verified only"),
                            FilterOption(DiscoveryOptionId.NEWEST_FIRST, "Newest first"),
                        ),
                    selectedIds = optionIds,
                ),
        ),
    )
}

/** Parse applied sections back into a typed model. */
internal fun discoveryFilters(sections: List<FilterSection>): DiscoverHubFilters {
    var result = DiscoverHubFilters.Default
    for (section in sections) {
        val control = section.control
        when {
            section.id == DiscoverySectionId.CONTENT_TYPE && control is FilterControl.ChipGroup ->
                result = result.copy(contentTypes = control.selectedIds)
            section.id == DiscoverySectionId.OPTIONS && control is FilterControl.Toggle ->
                result =
                    result.copy(
                        verifiedOnly = control.selectedIds.contains(DiscoveryOptionId.VERIFIED_ONLY),
                        newestFirst = control.selectedIds.contains(DiscoveryOptionId.NEWEST_FIRST),
                    )
        }
    }
    return result
}

/** Discovery filter bottom sheet. Host renders this when its sheet flag is on. */
@Composable
fun DiscoveryFilterSheet(
    initialFilters: DiscoverHubFilters,
    onApply: (DiscoverHubFilters) -> Unit,
    onDismiss: () -> Unit,
) {
    FilterSheetShell(
        sections = discoverySections(initialFilters),
        onApply = { sections -> onApply(discoveryFilters(sections)) },
        onDismiss = onDismiss,
        title = "Filters",
    )
}
