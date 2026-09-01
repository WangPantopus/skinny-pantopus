@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.discoverbusinesses

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
 * P5.2 — Paparazzi baselines for the Business filter sheet body. Two
 * frames: the cleared default (radius at the 5 mi default) and a
 * populated selection (category + distance + rating + open-now). Run
 * `./gradlew paparazziRecord` to generate the golden images.
 */
class BusinessFilterSheetSnapshotTest {
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
    fun business_filter_default() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = businessSections(DiscoverBusinessFilters.Default),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun business_filter_populated() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections =
                        businessSections(
                            DiscoverBusinessFilters(
                                categories = setOf("home-services", "pets"),
                                radiusMiles = 3.0,
                                openNow = true,
                                ratingFloor = 4.0,
                            ),
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
