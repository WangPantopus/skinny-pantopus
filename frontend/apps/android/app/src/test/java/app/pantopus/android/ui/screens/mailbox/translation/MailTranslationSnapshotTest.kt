@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.translation

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
 * Paparazzi snapshots for the B2.3 (A17.13) Translation screen.
 *
 * Baselines are recorded on first run via `./gradlew paparazziRecord`
 * and verified on every CI run via `./gradlew paparazziVerify`.
 * Annotated `@Ignore` until baselines land so the first PR doesn't fail
 * CI on a missing image — the batch-2 lockfile prompt (B7) records
 * baselines and removes the annotation.
 *
 * One snapshot per designed state (machine · confirmed), at the toggle's
 * default for that state (Side by side · Translated), matching the iOS
 * `TranslationSnapshotTests` frames.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class MailTranslationSnapshotTest {
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
    fun translation_machine() {
        paparazzi.snapshot {
            Frame {
                MailTranslationScreenContent(
                    state = MailTranslationUiState.Loaded(MailTranslationSampleData.letter()),
                    confirmInFlight = false,
                    toast = null,
                    onBack = {},
                    onSelectViewMode = {},
                    onConfirm = {},
                    onListen = {},
                    onReply = {},
                    onToast = {},
                    onRetry = {},
                )
            }
        }
    }

    @Test
    fun translation_confirmed() {
        paparazzi.snapshot {
            Frame {
                MailTranslationScreenContent(
                    state = MailTranslationUiState.Loaded(MailTranslationSampleData.confirmedLetter()),
                    confirmInFlight = false,
                    toast = null,
                    onBack = {},
                    onSelectViewMode = {},
                    onConfirm = {},
                    onListen = {},
                    onReply = {},
                    onToast = {},
                    onRetry = {},
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
