@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.gigs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetBody
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the P5.3 Gig filter sheet body — the default
 * (nothing selected) frame and the active frame exercising every
 * dimension (multi-category chips, a budget band, schedule chips, the
 * open-to-bids chip, and a posted-within radio selection).
 */
class GigFilterSheetSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2200,
                    softButtons = false,
                ),
        )

    @Test
    fun gig_filter_default() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = GigFilterCriteria().toSections(),
                    onApply = {},
                    onClose = {},
                    title = "Filters",
                )
            }
        }
    }

    @Test
    fun gig_filter_active_every_dimension() {
        val criteria =
            GigFilterCriteria(
                categories = setOf(GigsCategory.Handyman, GigsCategory.Cleaning),
                budgetLower = 50f,
                budgetUpper = 300f,
                schedules = setOf(GigScheduleFilter.OneTime),
                openToBids = true,
                postedWithin = GigPostedWithin.Week,
            )
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = criteria.toSections(),
                    onApply = {},
                    onClose = {},
                    title = "Filters",
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
