@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.start_train

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A12.11 — Paparazzi snapshots for the two Start-a-Support-Train step-1
 * frames: verified-neighbor recipient and invite-recipient.
 */
class StartSupportTrainSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2800,
                    softButtons = false,
                ),
        )

    @Test
    fun start_train_verified_neighbor_recipient() {
        paparazzi.snapshot {
            Frame {
                WhoAndWhyStep(
                    form =
                        StartSupportTrainFormState(
                            beneficiaryQuery = "Maya Patel",
                            selectedReason = StartSupportTrainReason.Surgery,
                            reason = StartSupportTrainSampleData.VERIFIED_CONTEXT_NOTE,
                        ),
                    results = emptyList(),
                    selected = StartSupportTrainSampleData.verifiedNeighbor,
                    isSearching = false,
                    mutuals = StartSupportTrainSampleData.mutuals,
                    inviteCandidate = null,
                    onQuery = {},
                    onSelectBeneficiary = {},
                    onClearBeneficiary = {},
                    onSearchAgain = {},
                    onSelectReason = {},
                    onReason = {},
                    onToggleInviteOnly = {},
                    onToggleBlockVisible = {},
                    onSelectInviteMethod = {},
                    reasonRemaining = 400,
                )
            }
        }
    }

    @Test
    fun start_train_invite_recipient() {
        paparazzi.snapshot {
            Frame {
                WhoAndWhyStep(
                    form =
                        StartSupportTrainFormState(
                            beneficiaryQuery = StartSupportTrainSampleData.INVITE_QUERY,
                            selectedReason = StartSupportTrainReason.Baby,
                        ),
                    results = emptyList(),
                    selected = null,
                    isSearching = false,
                    mutuals = emptyList(),
                    inviteCandidate = StartSupportTrainSampleData.inviteCandidate,
                    onQuery = {},
                    onSelectBeneficiary = {},
                    onClearBeneficiary = {},
                    onSearchAgain = {},
                    onSelectReason = {},
                    onReason = {},
                    onToggleInviteOnly = {},
                    onToggleBlockVisible = {},
                    onSelectInviteMethod = {},
                    reasonRemaining = 500,
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
                Column(modifier = Modifier.padding(16.dp)) { content() }
            }
        }
    }
}
