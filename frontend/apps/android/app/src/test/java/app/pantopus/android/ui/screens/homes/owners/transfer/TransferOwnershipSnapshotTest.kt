@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.owners.transfer

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.homes.owners.transfer.components.BiometricConfirmSheet
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A13.4 Paparazzi baselines for the Transfer Ownership form.
 *
 * Locks the two design frames:
 *  - ready: buyer email typed + resolved recipient card, TRANSFER typed,
 *    CTA armed.
 *  - confirm_sheet: biometric bottom sheet (rendered standalone so the
 *    scrim doesn't dominate the baseline diff).
 */
class TransferOwnershipSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun transfer_ownership_ready() {
        paparazzi.snapshot {
            Frame {
                TransferOwnershipLoaded(
                    state = readyState(),
                    onBack = {},
                    onRecipientChange = {},
                    onRecipientClear = {},
                    onConfirmationChange = {},
                    onArmCta = {},
                    onRetry = {},
                )
            }
        }
    }

    @Test
    fun transfer_ownership_confirm_sheet() {
        paparazzi.snapshot {
            Frame {
                val state = readyState()
                BiometricConfirmSheet(
                    parties = state.confirmSheetParties,
                    recipientName = state.recipientEmail,
                    homeAddress = state.homeAddress,
                    coOwnerNames = state.coOwnerNames,
                    timestamp = state.confirmationTimestamp,
                    biometryLabel = state.biometryLabel,
                    isAuthenticating = false,
                    onCancel = {},
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

    private fun readyState(): TransferOwnershipUiState =
        TransferOwnershipUiState(
            contextState = TransferContextState.Loaded,
            homeTitle = "412 Elm Street",
            homeAddress = "412 Elm Street",
            coOwnerNames = "Mateo and Jin",
            otherOwnerCount = 2,
            senderDisplayName = "Daniel Kovács",
            recipientField =
                FormFieldState(
                    id = "recipientEmail",
                    value = "buyer@example.com",
                    touched = true,
                ),
            confirmationField =
                FormFieldState(
                    id = "confirmation",
                    value = TRANSFER_CONFIRMATION_PHRASE,
                    touched = true,
                ),
            biometryLabel = "Face ID",
            confirmationTimestamp = "14:23 May 26",
        )
}
