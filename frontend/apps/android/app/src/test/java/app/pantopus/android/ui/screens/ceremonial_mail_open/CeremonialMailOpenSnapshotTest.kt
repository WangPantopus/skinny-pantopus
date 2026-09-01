@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.ceremonial_mail_open

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
 * Paparazzi snapshots for the four phases of the T3.8 Ceremonial
 * Mail Open screen. The animation is verified by snapshotting the
 * start/end values of the rotation + opacity transitions.
 */
class CeremonialMailOpenSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test fun ceremonial_mail_sealed_phase() {
        paparazzi.snapshot {
            Frame {
                LoadedBody(
                    letter = sampleLetter(),
                    phase = CeremonialMailPhase.Sealed,
                    isVoicePlaying = false,
                    onTapSeal = {},
                    onToggleVoice = {},
                    onWriteBack = {},
                    onOutcome = {},
                )
            }
        }
    }

    @Test fun ceremonial_mail_breaking_phase() {
        paparazzi.snapshot {
            Frame {
                LoadedBody(
                    letter = sampleLetter(),
                    phase = CeremonialMailPhase.Breaking,
                    isVoicePlaying = false,
                    onTapSeal = {},
                    onToggleVoice = {},
                    onWriteBack = {},
                    onOutcome = {},
                )
            }
        }
    }

    @Test fun ceremonial_mail_open_phase() {
        paparazzi.snapshot {
            Frame {
                LoadedBody(
                    letter = sampleLetter(),
                    phase = CeremonialMailPhase.Open,
                    isVoicePlaying = false,
                    onTapSeal = {},
                    onToggleVoice = {},
                    onWriteBack = {},
                    onOutcome = {},
                )
            }
        }
    }

    @Test fun ceremonial_mail_replying_phase() {
        paparazzi.snapshot {
            Frame {
                LoadedBody(
                    letter = sampleLetter(),
                    phase = CeremonialMailPhase.Replying,
                    isVoicePlaying = true,
                    onTapSeal = {},
                    onToggleVoice = {},
                    onWriteBack = {},
                    onOutcome = {},
                )
            }
        }
    }

    private fun sampleLetter(): CeremonialMailLetter =
        CeremonialMailLetter(
            mailId = "mail_demo",
            sender =
                CeremonialSenderCard(
                    displayName = "Maya K.",
                    handle = "mayak",
                    trustLabel = "Pantopus friend",
                    avatarUrl = null,
                ),
            category = "letter",
            subject = "A note from a friend",
            bodyParagraphs =
                listOf(
                    "Dear Alice,",
                    "I was thinking about the afternoon we spent at the old library — the smell of paper, the dust drifting in the light.",
                    "I hope this letter finds you well.",
                    "With warmth,\nMaya",
                ),
            stationery = CeremonialMailStationeryTone.MidnightBlue,
            ink = CeremonialMailInkTone.Navy,
            seal = CeremonialMailSealTone.WaxRed,
            voicePostscriptUri = "https://uploads.test/voice/v1.m4a",
            receivedAt = "2026-05-15T12:00:00Z",
            outcomeCtas = CeremonialMailLetter.defaultOutcomeCtas(),
        )

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
