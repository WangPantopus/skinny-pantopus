@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.invite_owner

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/** A13.2 Paparazzi baselines for Invite Owner. */
class InviteOwnerFormSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1800,
                    softButtons = false,
                ),
        )

    @Test
    fun invite_owner_valid() {
        paparazzi.snapshot {
            Frame {
                InviteOwnerLoadedForm(
                    state = stateFrom(InviteOwnerSampleData.Valid),
                    onClose = {},
                    onCommit = {},
                    onFieldChange = { _, _ -> },
                    onGrantChange = {},
                    onSnapToAvailable = {},
                    onRebalance = {},
                )
            }
        }
    }

    @Test
    fun invite_owner_conflict() {
        paparazzi.snapshot {
            Frame {
                InviteOwnerLoadedForm(
                    state = stateFrom(InviteOwnerSampleData.Conflict),
                    onClose = {},
                    onCommit = {},
                    onFieldChange = { _, _ -> },
                    onGrantChange = {},
                    onSnapToAvailable = {},
                    onRebalance = {},
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

    private fun stateFrom(draft: InviteOwnerDraft): InviteOwnerUiState =
        InviteOwnerUiState(
            phase = InviteOwnerPhase.Editing,
            homeContext = draft.homeContext,
            owners = draft.owners,
            fields =
                mapOf(
                    InviteOwnerField.Email to
                        FormFieldState(
                            id = InviteOwnerField.Email.key,
                            value = draft.email,
                            touched = draft.email.isNotEmpty(),
                        ),
                    InviteOwnerField.Phone to
                        FormFieldState(
                            id = InviteOwnerField.Phone.key,
                            value = draft.phone,
                            touched = draft.phone.isNotEmpty(),
                        ),
                    InviteOwnerField.Role to
                        FormFieldState(
                            id = InviteOwnerField.Role.key,
                            value = draft.role,
                            touched = draft.role.isNotEmpty(),
                        ),
                ),
            grantPercent = draft.grantPercent,
            originalGrantPercent = 0,
            autoBalancesSoleOwner = draft.autoBalancesSoleOwner,
        )
}
