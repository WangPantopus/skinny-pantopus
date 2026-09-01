@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet.scheduling

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.wallet.ActivityDirection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

class PaymentsSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private fun model(
        setup: PaymentsSetupViewModel.Setup,
        charges: PaymentsSetupViewModel.PillState,
        payouts: PaymentsSetupViewModel.PillState,
        details: PaymentsSetupViewModel.PillState,
        connected: Boolean,
        returned: Boolean = false,
    ) = PaymentsModel(setup, charges, payouts, details, connected, returned)

    @Test
    fun payments_setup_not_connected() =
        paparazzi.snapshot {
            Frame {
                PaymentsSetupContent(
                    model =
                        model(
                            PaymentsSetupViewModel.Setup.NotConnected,
                            PaymentsSetupViewModel.PillState.Off,
                            PaymentsSetupViewModel.PillState.Off,
                            PaymentsSetupViewModel.PillState.Off,
                            connected = false,
                        ),
                    connecting = false,
                    onConnect = {},
                    onOpenDashboard = {},
                )
            }
        }

    @Test
    fun payments_setup_ready() =
        paparazzi.snapshot {
            Frame {
                PaymentsSetupContent(
                    model =
                        model(
                            PaymentsSetupViewModel.Setup.Ready,
                            PaymentsSetupViewModel.PillState.On,
                            PaymentsSetupViewModel.PillState.On,
                            PaymentsSetupViewModel.PillState.On,
                            connected = true,
                        ),
                    connecting = false,
                    onConnect = {},
                    onOpenDashboard = {},
                )
            }
        }

    @Test
    fun payments_setup_restricted() =
        paparazzi.snapshot {
            Frame {
                PaymentsSetupContent(
                    model =
                        model(
                            PaymentsSetupViewModel.Setup.Restricted,
                            PaymentsSetupViewModel.PillState.On,
                            PaymentsSetupViewModel.PillState.Warn,
                            PaymentsSetupViewModel.PillState.Warn,
                            connected = true,
                        ),
                    connecting = false,
                    onConnect = {},
                    onOpenDashboard = {},
                )
            }
        }

    @Test
    fun payouts_populated() =
        paparazzi.snapshot {
            Frame {
                PayoutsEarningsContent(
                    model = earningsModel(PayoutsEarningsViewModel.PayoutState.Enabled),
                    source = EarningsSource.Booking,
                    withdrawing = false,
                    onSetSource = {},
                    onWithdraw = {},
                    onSetupPayouts = {},
                    onOpenDashboard = {},
                )
            }
        }

    @Test
    fun payouts_not_enabled() =
        paparazzi.snapshot {
            Frame {
                PayoutsEarningsContent(
                    model = earningsModel(PayoutsEarningsViewModel.PayoutState.NotEnabled),
                    source = EarningsSource.Booking,
                    withdrawing = false,
                    onSetSource = {},
                    onWithdraw = {},
                    onSetupPayouts = {},
                    onOpenDashboard = {},
                )
            }
        }

    private fun earningsModel(payoutState: PayoutsEarningsViewModel.PayoutState) =
        EarningsModel(
            availableDisplay = "847.50",
            availableCents = 84_750L,
            pendingDisplay = "$268.00",
            pendingMeta = "2 bookings",
            monthDisplay = "$1,642.00",
            monthMeta = "6 bookings this month",
            allRows =
                listOf(
                    EarningRow(
                        "1", "Today", "Haircut · Dana R.", "2:14 PM", "48.00",
                        ActivityDirection.In, EarningsSource.Booking, isPending = true, isFee = false,
                    ),
                    EarningRow(
                        "2", "Today", "Color & cut · Marcus L.", "11:02 AM", "96.00",
                        ActivityDirection.In, EarningsSource.Booking, isPending = false, isFee = false,
                    ),
                    EarningRow(
                        "3", "Yesterday", "5-session package · Priya N.", "4:30 PM", "220.00",
                        ActivityDirection.In, EarningsSource.Booking, isPending = false, isFee = false,
                    ),
                ),
            payoutState = payoutState,
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
