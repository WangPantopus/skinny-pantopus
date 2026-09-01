@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.explore

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetShell

/**
 * A11.2 Explore — filter bottom sheet. Reuses the shared FilterSheet
 * archetype with content type (multi-chip), distance radius (step
 * slider), and verified-only / open-now toggles. Mirrors the iOS
 * `ExploreFilterSheet.swift`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreFilterSheet(
    criteria: ExploreFilterCriteria,
    onApply: (ExploreFilterCriteria) -> Unit,
    onDismiss: () -> Unit,
) {
    FilterSheetShell(
        sections = criteria.toSections(),
        onApply = { sections -> onApply(ExploreFilterCriteria.fromSections(sections)) },
        onDismiss = onDismiss,
        title = "Filters",
    )
}
