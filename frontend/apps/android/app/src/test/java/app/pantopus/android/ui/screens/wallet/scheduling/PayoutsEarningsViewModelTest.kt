@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet.scheduling

import app.cash.turbine.test
import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.models.connect.ConnectAccountStatusResponse
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountResponse
import app.pantopus.android.data.api.models.connect.ConnectOnboardingResponse
import app.pantopus.android.data.api.models.wallet.WalletBalanceResponse
import app.pantopus.android.data.api.models.wallet.WalletDto
import app.pantopus.android.data.api.models.wallet.WalletPendingReleaseResponse
import app.pantopus.android.data.api.models.wallet.WalletTransactionDto
import app.pantopus.android.data.api.models.wallet.WalletTransactionsResponse
import app.pantopus.android.data.api.models.wallet.WalletWithdrawResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.wallet.WalletRepository
import app.pantopus.android.ui.screens.wallet.ActivityDirection
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PayoutsEarningsViewModelTest {
    private val wallet: WalletRepository = mockk()
    private val connect: ConnectRepository = mockk(relaxed = true)

    @Before
    fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { wallet.balance() } returns NetworkResult.Success(WalletBalanceResponse(WalletDto(id = "w", balance = 84_750L)))
        coEvery { wallet.transactions(any(), any()) } returns NetworkResult.Success(WalletTransactionsResponse(emptyList()))
        coEvery { wallet.pendingRelease() } returns NetworkResult.Success(WalletPendingReleaseResponse())
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun flags(enabled: Boolean) = SchedulingFeatureFlags().apply { environment = if (enabled) "development" else "production" }

    private fun vm(enabled: Boolean = true) = PayoutsEarningsViewModel(wallet, connect, flags(enabled))

    private fun account(
        connected: Boolean,
        payouts: Boolean,
    ) = NetworkResult.Success(
        ConnectAccountStatusResponse(
            ConnectAccountDto(stripeAccountId = if (connected) "acct_1" else null, payoutsEnabled = payouts),
        ),
    )

    // ─── Pure projections ──────────────────────────────────────────────────

    @Test
    fun `payout state derives from connect account`() {
        val c = PayoutsEarningsViewModel
        assertEquals(PayoutsEarningsViewModel.PayoutState.NotEnabled, c.payoutState(null))
        assertEquals(PayoutsEarningsViewModel.PayoutState.NotEnabled, c.payoutState(ConnectAccountDto(stripeAccountId = null)))
        assertEquals(
            PayoutsEarningsViewModel.PayoutState.Enabled,
            c.payoutState(ConnectAccountDto(stripeAccountId = "a", payoutsEnabled = true)),
        )
        assertEquals(
            PayoutsEarningsViewModel.PayoutState.OnHold,
            c.payoutState(ConnectAccountDto(stripeAccountId = "a", payoutsEnabled = false)),
        )
    }

    @Test
    fun `row projects source direction and pending`() {
        val booking =
            PayoutsEarningsViewModel.projectRow(
                WalletTransactionDto(id = "t1", type = "gig_income", amount = 4_800L, description = "Booking · Dana", status = "pending"),
            )
        assertEquals(EarningsSource.Booking, booking.source)
        assertEquals(ActivityDirection.In, booking.direction)
        assertTrue(booking.isPending)
        assertEquals("Pending", booking.statusLabel)

        val pkg =
            PayoutsEarningsViewModel.projectRow(
                WalletTransactionDto(
                    id = "t2",
                    type = "gig_income",
                    amount = 22_000L,
                    description = "5-session package",
                    status = "completed",
                ),
            )
        assertEquals(EarningsSource.Packages, pkg.source)

        val fee =
            PayoutsEarningsViewModel.projectRow(
                WalletTransactionDto(
                    id = "t3",
                    type = "cancellation_fee",
                    amount = 660L,
                    description = "Service fee",
                    status = "completed",
                ),
            )
        assertEquals(ActivityDirection.Out, fee.direction)
        assertTrue(fee.isFee)
        assertEquals("Fee", fee.statusLabel)
    }

    // ─── Load ──────────────────────────────────────────────────────────────

    @Test
    fun `flag off yields NotEnabled`() =
        runTest {
            val vm = vm(enabled = false)
            vm.load()
            assertEquals(PayoutsEarningsUiState.NotEnabled, vm.state.value)
        }

    @Test
    fun `load builds the earnings model`() =
        runTest {
            coEvery { connect.accountStatus() } returns account(connected = true, payouts = true)
            val vm = vm()
            vm.load()
            val loaded = vm.state.value as PayoutsEarningsUiState.Loaded
            assertEquals("847.50", loaded.model.availableDisplay)
            assertEquals(PayoutsEarningsViewModel.PayoutState.Enabled, loaded.model.payoutState)
        }

    // ─── Withdraw gating ─────────────────────────────────────────────────────

    @Test
    fun `withdraw blocked when payouts not enabled`() =
        runTest {
            coEvery { connect.accountStatus() } returns account(connected = false, payouts = false)
            val vm = vm()
            vm.load()
            vm.withdraw()
            assertEquals("Set up payouts before withdrawing.", vm.toast.value)
            coVerify(exactly = 0) { wallet.withdraw(any()) }
        }

    @Test
    fun `withdraw succeeds when enabled`() =
        runTest {
            coEvery { connect.accountStatus() } returns account(connected = true, payouts = true)
            coEvery { wallet.withdraw(any()) } returns
                NetworkResult.Success(WalletWithdrawResponse(success = true, message = "Withdrawal initiated."))
            val vm = vm()
            vm.load()
            vm.withdraw()
            assertEquals("Withdrawal initiated.", vm.toast.value)
            coVerify { wallet.withdraw(any()) }
        }

    @Test
    fun `setupPayouts opens the onboarding url`() =
        runTest {
            coEvery { connect.accountStatus() } returns account(connected = false, payouts = false)
            coEvery { connect.createAccount() } returns NetworkResult.Success(ConnectCreateAccountResponse())
            coEvery { connect.onboarding() } returns
                NetworkResult.Success(ConnectOnboardingResponse(onboardingUrl = "https://stripe.test/onboard"))
            val vm = vm()
            vm.load()
            vm.events.test {
                vm.setupPayouts()
                val event = awaitItem()
                assertEquals("https://stripe.test/onboard", event.url)
                assertTrue(event.refreshOnReturn)
                cancelAndIgnoreRemainingEvents()
            }
        }
}
