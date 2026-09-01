@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.nearby.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.gigs.GigFilterCriteria
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterSheetBody
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the P5.3 Nearby map filter sheet body — the
 * default frame and an active frame with the entity-type radio, a
 * tightened distance band, and gig dimensions set.
 */
class MapFilterSheetSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2600,
                    softButtons = false,
                ),
        )

    @Test
    fun map_filter_default() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = MapFilterCriteria().toSections(),
                    onApply = {},
                    onClose = {},
                    title = "Filters",
                )
            }
        }
    }

    @Test
    fun map_filter_active() {
        val criteria =
            MapFilterCriteria(
                entityType = MapEntityType.Gigs,
                distanceLower = 0f,
                distanceUpper = 2f,
                gig =
                    GigFilterCriteria(
                        categories = setOf(GigsCategory.Handyman),
                        openToBids = true,
                    ),
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
