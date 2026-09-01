@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.payments

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

class PolicySnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private fun form(
        preset: CancellationRefundPolicyViewModel.Preset,
        cutoff: Int,
        refund: Int,
        depositNonRefundable: Boolean,
        noShow: CancellationRefundPolicyViewModel.NoShowMode,
        preview: String,
        footnote: String,
    ) = PolicyForm(
        selectedPreset = preset,
        customCutoffHours = cutoff,
        customRefundPct = refund,
        depositNonRefundable = depositNonRefundable,
        noShowMode = noShow,
        canDecrementCutoff = cutoff > 0,
        canIncrementCutoff = cutoff < 72,
        canDecrementRefund = refund > 0,
        canIncrementRefund = refund < 100,
        previewText = preview,
        footnote = footnote,
    )

    @Test
    fun policy_flexible() =
        paparazzi.snapshot {
            Frame {
                PolicyLoaded(
                    form =
                        form(
                            CancellationRefundPolicyViewModel.Preset.Flexible,
                            24,
                            0,
                            true,
                            CancellationRefundPolicyViewModel.NoShowMode.ChargeFull,
                            "Free cancellation up to 24 hours before. After that, no refund.",
                            "Flexible is the friendliest — most people start here.",
                        ),
                    saving = false,
                    onSelect = {},
                    onDecCutoff = {},
                    onIncCutoff = {},
                    onDecRefund = {},
                    onIncRefund = {},
                    onToggleDeposit = {},
                    onCycleNoShow = {},
                    onSave = {},
                )
            }
        }

    @Test
    fun policy_strict() =
        paparazzi.snapshot {
            Frame {
                PolicyLoaded(
                    form =
                        form(
                            CancellationRefundPolicyViewModel.Preset.Strict,
                            0,
                            0,
                            true,
                            CancellationRefundPolicyViewModel.NoShowMode.ChargeFull,
                            "No refund once the booking is confirmed.",
                            "Invitees see this wording before they pay.",
                        ),
                    saving = false,
                    onSelect = {},
                    onDecCutoff = {},
                    onIncCutoff = {},
                    onDecRefund = {},
                    onIncRefund = {},
                    onToggleDeposit = {},
                    onCycleNoShow = {},
                    onSave = {},
                )
            }
        }

    @Test
    fun policy_custom() =
        paparazzi.snapshot {
            Frame {
                PolicyLoaded(
                    form =
                        form(
                            CancellationRefundPolicyViewModel.Preset.Custom,
                            24,
                            50,
                            true,
                            CancellationRefundPolicyViewModel.NoShowMode.ChargeFull,
                            "24 hours before: full refund. After that: 50% refund. Deposit is non-refundable.",
                            "Invitees see this wording before they pay.",
                        ),
                    saving = false,
                    onSelect = {},
                    onDecCutoff = {},
                    onIncCutoff = {},
                    onDecRefund = {},
                    onIncRefund = {},
                    onToggleDeposit = {},
                    onCycleNoShow = {},
                    onSave = {},
                )
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
