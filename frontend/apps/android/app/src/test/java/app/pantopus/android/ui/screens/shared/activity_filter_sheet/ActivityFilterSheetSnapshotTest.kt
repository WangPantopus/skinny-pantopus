@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.activity_filter_sheet

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetBody
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * P5.4 — Paparazzi baselines for the generic ActivityFilterSheet body.
 * Renders the (non-modal) [FilterSheetBody] over the activity sections
 * for three states: a default (no-filter) bids sheet, a populated bids
 * sheet (status + sort + date selected), and a posts sheet (intent
 * chips + the time-only sort subset).
 */
class ActivityFilterSheetSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1800,
                    softButtons = false,
                ),
        )

    private val bidStatusOptions =
        listOf(
            FilterOption("pending", "Pending"),
            FilterOption("accepted", "Accepted"),
            FilterOption("declined", "Declined"),
            FilterOption("completed", "Completed"),
        )

    private val postTypeOptions =
        listOf(
            FilterOption("ask", "Ask"),
            FilterOption("recommend", "Recommend"),
            FilterOption("event", "Event"),
            FilterOption("lost", "Lost & Found"),
            FilterOption("announce", "Announce"),
        )

    @Test
    fun activity_filter_default_no_selection() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections =
                        activityFilterSections(
                            statusTitle = "Bid status",
                            statusOptions = bidStatusOptions,
                            sortOptions = ActivitySortOrder.ALL,
                            filter = ActivityFilter(),
                        ),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun activity_filter_populated() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections =
                        activityFilterSections(
                            statusTitle = "Bid status",
                            statusOptions = bidStatusOptions,
                            sortOptions = ActivitySortOrder.ALL,
                            filter =
                                ActivityFilter(
                                    statusIds = setOf("pending", "accepted"),
                                    sort = ActivitySortOrder.Newest,
                                    dateRange = ActivityDateRange.Week,
                                ),
                        ),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun activity_filter_posts_time_only_sort() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections =
                        activityFilterSections(
                            statusTitle = "Type",
                            statusOptions = postTypeOptions,
                            sortOptions = ActivitySortOrder.TIME_ONLY,
                            filter = ActivityFilter(statusIds = setOf("ask"), dateRange = ActivityDateRange.Today),
                        ),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

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
