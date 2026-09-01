@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.ceremonial_mail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.mail_compose.MailHomeContextResponse
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the four design moments of the
 * Ceremonial Mail Compose wizard.
 */
class CeremonialMailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test fun ceremonial_decide_step() {
        paparazzi.snapshot {
            Frame {
                DecideStep(
                    form = CeremonialMailFormState(recipientQuery = "maya"),
                    results = listOf(sampleRecipient()),
                    selected = sampleRecipient(),
                    isSearching = false,
                    onQuery = {},
                    onSelectRecipient = {},
                    onSelectIntent = {},
                )
            }
        }
    }

    @Test fun ceremonial_verify_step() {
        paparazzi.snapshot {
            Frame {
                VerifyStep(
                    form = CeremonialMailFormState(step = CeremonialMailStep.Verify, addressConfirmed = true),
                    selected = sampleRecipient(),
                    homeContext = sampleHomeContext(),
                    onAddressConfirmed = {},
                    onReturnAddressShared = {},
                )
            }
        }
    }

    @Test fun ceremonial_compose_step() {
        paparazzi.snapshot {
            Frame {
                ComposeStep(
                    form =
                        CeremonialMailFormState(
                            step = CeremonialMailStep.Compose,
                            stationery = CeremonialMailStationery.MidnightBlue,
                            ink = CeremonialMailInk.Navy,
                            seal = CeremonialMailSeal.WaxRed,
                            bodyText = "Dear Maya, I was thinking about you this morning.",
                        ),
                    voiceStatus = VoicePostscriptStatus.Uploaded("https://example/v1.m4a"),
                    onSelectStationery = {},
                    onSelectInk = {},
                    onSelectSeal = {},
                    onUpdateBody = {},
                    onRecordVoice = {},
                    onClearVoice = {},
                )
            }
        }
    }

    @Test fun ceremonial_commit_step() {
        paparazzi.snapshot {
            Frame {
                CommitStep(
                    form =
                        CeremonialMailFormState(
                            step = CeremonialMailStep.Commit,
                            stationery = CeremonialMailStationery.MidnightBlue,
                            ink = CeremonialMailInk.Navy,
                            seal = CeremonialMailSeal.WaxRed,
                            sendTiming = CeremonialMailSendTiming.Morning,
                        ),
                    selected = sampleRecipient(),
                    voiceUploaded = true,
                    onSelectTiming = {},
                )
            }
        }
    }

    private fun sampleRecipient(): MailRecipientDto =
        MailRecipientDto(
            userId = "u_maya",
            name = "Maya K.",
            username = "mayak",
            homeId = "home_demo",
            homeAddress = "412 Elm St, Portland, OR",
            isVerified = true,
            homeMediaUrl = null,
            isOnPantopus = true,
        )

    private fun sampleHomeContext(): MailHomeContextResponse =
        MailHomeContextResponse(
            homeId = "home_demo",
            addressDisplay = "412 Elm St, Portland, OR",
            memberCount = 2,
            privateDeliveryAvailable = true,
            members = emptyList(),
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                androidx.compose.foundation.layout.Column(modifier = Modifier.padding(16.dp)) { content() }
            }
        }
    }
}
