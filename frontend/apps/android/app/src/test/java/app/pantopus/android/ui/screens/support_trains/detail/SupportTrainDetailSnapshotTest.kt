@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * A10.9 (P3.1) — Paparazzi snapshots for the participant-facing
 * Support Train detail. Two variants: populated (12 / 21 covered ·
 * 9 open) and fully covered (celebration banner + viewer's
 * commitment + split dock).
 *
 * Baselines record on first run via `./gradlew paparazziRecord` and
 * verify on every CI run via `./gradlew paparazziVerify`. Annotated
 * `@Ignore` until baselines land so the first PR doesn't fail CI on
 * a missing image — the follow-up records baselines and removes the
 * annotation.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class SupportTrainDetailSnapshotTest {
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
    fun support_train_detail_populated() {
        paparazzi.snapshot {
            Frame {
                SupportTrainDetailContentLayout(
                    state = SupportTrainDetailUiState.Loaded(SupportTrainDetailSampleData.populated),
                )
            }
        }
    }

    @Test
    fun support_train_detail_fully_covered() {
        paparazzi.snapshot {
            Frame {
                SupportTrainDetailContentLayout(
                    state = SupportTrainDetailUiState.Loaded(SupportTrainDetailSampleData.fullyCovered),
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
