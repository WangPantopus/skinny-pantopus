@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.filter_sheet

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the shared FilterSheet body. Three frames:
 * a populated mixed-control sheet (every control kind), an empty
 * sheet (no sections), and a sheet with the selection cleared.
 */
class FilterSheetShellSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1800,
                    softButtons = false,
                ),
        )

    @Test
    fun filter_sheet_populated_every_control_kind() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = sampleSections(),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun filter_sheet_no_sections() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = emptyList(),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun filter_sheet_cleared_baseline() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = sampleSections().cleared(),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun filter_sheet_sort_only_radio() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    title = "Sort",
                    sections =
                        listOf(
                            FilterSection(
                                id = "sort",
                                title = "Sort by",
                                control =
                                    FilterControl.Radio(
                                        options =
                                            listOf(
                                                FilterOption("recent", "Most recent"),
                                                FilterOption("price-asc", "Price: low to high"),
                                                FilterOption("price-desc", "Price: high to low"),
                                                FilterOption("distance", "Distance"),
                                            ),
                                        selectedId = "price-asc",
                                    ),
                            ),
                        ),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    // ─── Fixtures ──────────────────────────────────────

    private fun sampleSections(): List<FilterSection> =
        listOf(
            FilterSection(
                id = "category",
                title = "Category",
                control =
                    FilterControl.ChipGroup(
                        options =
                            listOf(
                                FilterOption("handyman", "Handyman"),
                                FilterOption("cleaning", "Cleaning"),
                                FilterOption("moving", "Moving"),
                                FilterOption("pets", "Pet care"),
                                FilterOption("tutoring", "Tutoring"),
                            ),
                        selectedIds = setOf("handyman", "moving"),
                    ),
            ),
            FilterSection(
                id = "sort",
                title = "Sort by",
                control =
                    FilterControl.Radio(
                        options =
                            listOf(
                                FilterOption("recent", "Most recent"),
                                FilterOption("price-asc", "Price: low to high"),
                                FilterOption("distance", "Distance"),
                            ),
                        selectedId = "recent",
                    ),
            ),
            FilterSection(
                id = "tags",
                title = "Tags",
                control =
                    FilterControl.MultiSelect(
                        options =
                            listOf(
                                FilterOption("verified", "Verified posters"),
                                FilterOption("delivery", "Delivery available"),
                                FilterOption("negotiable", "Price negotiable"),
                            ),
                        selectedIds = setOf("verified"),
                    ),
            ),
            FilterSection(
                id = "price",
                title = "Price",
                control =
                    FilterControl.RangeSlider(
                        FilterRange(min = 0f, max = 500f, lower = 50f, upper = 350f, step = 10f),
                    ),
            ),
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
