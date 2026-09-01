@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.disambiguate

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
 * A13.15 reshape — Paparazzi baselines for the Disambiguate form in its
 * strong-match and unclear-scan frames. Renders the stateless
 * [DisambiguateContent] (the Hilt-backed screen can't render under Paparazzi).
 *
 * Record baselines with `./gradlew paparazziRecord`.
 */
class DisambiguateSnapshotTest {
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
    fun disambiguate_strong_match() {
        paparazzi.snapshot {
            Frame {
                DisambiguateContent(
                    state =
                        DisambiguateUiState(
                            ocrRecipient = "Maria K. · 412 Elm St",
                            confidence = 0.97,
                            candidates = DisambiguateMailFormViewModel.sampleCandidates(clear = true),
                            selection = MailRoutingSelection.Candidate("maria"),
                        ),
                    onClose = {},
                    onSelectCandidate = {},
                    onThisIsMe = {},
                    onRouteToOther = {},
                    onAddNewPerson = {},
                    onFallback = {},
                    onConfirm = {},
                )
            }
        }
    }

    @Test
    fun disambiguate_unclear_scan() {
        paparazzi.snapshot {
            Frame {
                DisambiguateContent(
                    state =
                        DisambiguateUiState(
                            ocrRecipient = "M___ K___ · 4__ Elm St",
                            confidence = 0.31,
                            candidates = DisambiguateMailFormViewModel.sampleCandidates(clear = false),
                            selection = null,
                        ),
                    onClose = {},
                    onSelectCandidate = {},
                    onThisIsMe = {},
                    onRouteToOther = {},
                    onAddNewPerson = {},
                    onFallback = {},
                    onConfirm = {},
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
