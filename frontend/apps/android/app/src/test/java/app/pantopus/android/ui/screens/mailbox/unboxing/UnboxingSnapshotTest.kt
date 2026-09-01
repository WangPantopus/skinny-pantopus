@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.unboxing

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
 * A17.14 — Paparazzi snapshots for the Unboxing scan-capture flow. Two
 * frames mirror the design source and the iOS baselines so the two
 * platforms stay identical: the classified `capture` frame (live viewfinder
 * fallback + filmstrip + AI suggestion + extracted facts) and the `filed`
 * confirmed summary. The `CameraScanner` renders its static placeholder
 * under Compose inspection, so these frames are deterministic.
 */
class UnboxingSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun unboxing_capture() {
        paparazzi.snapshot {
            Frame {
                UnboxingCaptureFrame(content = UnboxingSampleData.content)
            }
        }
    }

    @Test
    fun unboxing_filed() {
        paparazzi.snapshot {
            Frame {
                UnboxingFiledFrame(content = UnboxingSampleData.content)
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
