@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.discoverhub

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
 * P5.2 — Paparazzi baselines for the Discovery filter sheet body. Two
 * frames: the cleared default and a populated selection (content type +
 * both toggles). Run `./gradlew paparazziRecord` to generate the
 * golden images.
 */
class DiscoveryFilterSheetSnapshotTest {
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
    fun discovery_filter_default() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections = discoverySections(DiscoverHubFilters.Default),
                    onApply = {},
                    onClose = {},
                )
            }
        }
    }

    @Test
    fun discovery_filter_populated() {
        paparazzi.snapshot {
            Frame {
                FilterSheetBody(
                    sections =
                        discoverySections(
                            DiscoverHubFilters(
                                contentTypes = setOf(DiscoverHubSection.PEOPLE, DiscoverHubSection.GIGS),
                                verifiedOnly = true,
                                newestFirst = true,
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
