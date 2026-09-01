@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

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

/** Paparazzi baselines for A.4 / A13.5 Property Details. */
class PropertyDetailsSnapshotTest {
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
    fun property_details_clean() {
        paparazzi.snapshot {
            Frame {
                PropertyDetailsScreenContent(
                    state = PropertyDetailsUiState.Clean(PropertyDetailsSampleData.clean),
                    onBack = {},
                    onRetry = {},
                    onRequestCorrection = {},
                    renderGoogleMap = false,
                )
            }
        }
    }

    @Test
    fun property_details_mismatch() {
        paparazzi.snapshot {
            Frame {
                PropertyDetailsScreenContent(
                    state = PropertyDetailsUiState.Mismatch(PropertyDetailsSampleData.mismatch),
                    onBack = {},
                    onRetry = {},
                    onRequestCorrection = {},
                    renderGoogleMap = false,
                )
            }
        }
    }

    @Test
    fun property_details_loading() {
        paparazzi.snapshot {
            Frame {
                PropertyDetailsScreenContent(
                    state = PropertyDetailsUiState.Loading,
                    onBack = {},
                    onRetry = {},
                    onRequestCorrection = {},
                    renderGoogleMap = false,
                )
            }
        }
    }

    @Test
    fun property_details_error() {
        paparazzi.snapshot {
            Frame {
                PropertyDetailsScreenContent(
                    state = PropertyDetailsUiState.Error("Couldn't reach property records."),
                    onBack = {},
                    onRetry = {},
                    onRequestCorrection = {},
                    renderGoogleMap = false,
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
            ) {
                content()
            }
        }
    }
}
