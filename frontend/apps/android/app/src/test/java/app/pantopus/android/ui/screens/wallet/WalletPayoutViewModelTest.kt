@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet

import app.cash.turbine.test
import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.models.connect.ConnectAccountStatusResponse
import app.pantopus.android.data.api.models.connect.ConnectCreateAccountResponse
import app.pantopus.android.data.api.models.connect.ConnectDashboardResponse
import app.pantopus.android.data.api.models.connect.ConnectOnboardingResponse
import app.pantopus.android.data.api.models.wallet.WalletBalanceResponse
import app.pantopus.android.data.api.models.wallet.WalletDto
import app.pantopus.android.data.api.models.wallet.WalletPendingReleaseResponse
import app.pantopus.android.data.api.models.wallet.WalletTransactionsResponse
import app.pantopus.android.data.api.models.wallet.WalletWithdrawResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.wallet.WalletRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Block 3C — the Wallet payout side: withdraw + Stripe Connect onboarding /
 * dashboard. Mirrors iOS `WalletPayoutTests`. The browser open happens in the
 * screen, so here we assert the VM's gating, withdraw round-trip, and the
 * OpenUrl events.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class WalletPayoutViewModelTest {
    private val repository: WalletRepository = mockk()
    private val connectRepository: ConnectRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { repository.balance() } returns
            NetworkResult.Success(WalletBalanceResponse(WalletDto(id = "w1", balance = 84_750L)))
        coEvery { repository.transactions() } returns NetworkResult.Success(WalletTransactionsResponse(emptyList()))
        coEvery { repository.pendingRelease() } returns NetworkResult.Success(WalletPendingReleaseResponse())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun stubPayouts(enabled: Boolean) {
        coEvery { connectRepository.accountStatus() } returns
            if (enabled) {
                NetworkResult.Success(ConnectAccountStatusResponse(ConnectAccountDto(payoutsEnabled = true)))
            } else {
                NetworkResult.Failure(NetworkError.Server(404, "no account"))
            }
    }

    private fun vm() = WalletViewModel(repository, connectRepository)

    // MARK: - Gating

    @Test
    fun load_reflects_payouts_enabled() =
        runTest {
            stubPayouts(enabled = true)
            val vm = vm()
            vm.load()
            val content = (vm.state.value as WalletUiState.Populated).content
            assertTrue(content.payoutsEnabled)
        }

    @Test
    fun load_without_connect_account_gates_payouts() =
        runTest {
            stubPayouts(enabled = false)
            val vm = vm()
            vm.load()
            val content = (vm.state.value as WalletUiState.Populated).content
            assertFalse(content.payoutsEnabled)
        }

    // MARK: - Payout-account card (makes "Open Stripe Dashboard" reachable)

    /**
     * An onboarded account renders the Payout-account card — the only
     * reachable entry point to the Stripe Express dashboard.
     */
    @Test
    fun onboarded_account_surfaces_dashboard_action() =
        runTest {
            coEvery { connectRepository.accountStatus() } returns
                NetworkResult.Success(
                    ConnectAccountStatusResponse(
                        ConnectAccountDto(
                            stripeAccountId = "acct_1",
                            chargesEnabled = true,
                            payoutsEnabled = true,
                            detailsSubmitted = true,
                        ),
                    ),
                )
            val vm = vm()
            vm.load()
            val content = (vm.state.value as WalletUiState.Populated).content
            assertEquals("Stripe account connected", content.payoutAccount?.headline)
            assertEquals("Open Stripe Dashboard", content.payoutAccount?.actionLabel)
            assertEquals(false, content.payoutAccount?.warn)
        }

    /** An account that exists but isn't onboarded resumes hosted onboarding. */
    @Test
    fun pending_account_surfaces_continue_setup() =
        runTest {
            coEvery { connectRepository.accountStatus() } returns
                NetworkResult.Success(
                    ConnectAccountStatusResponse(
                        ConnectAccountDto(
                            stripeAccountId = "acct_1",
                            chargesEnabled = false,
                            payoutsEnabled = false,
                            detailsSubmitted = true,
                        ),
                    ),
                )
            val vm = vm()
            vm.load()
            val content = (vm.state.value as WalletUiState.Populated).content
            assertEquals("Continue setup", content.payoutAccount?.actionLabel)
            assertEquals(true, content.payoutAccount?.warn)
            assertFalse(content.payoutsEnabled)
        }

    /**
     * No connected account → no card (the bottom bar's "Set up payouts" stays
     * the entry point) and nothing fabricated.
     */
    @Test
    fun no_connect_account_hides_payout_card() =
        runTest {
            stubPayouts(enabled = false)
            val vm = vm()
            vm.load()
            val content = (vm.state.value as WalletUiState.Populated).content
            assertEquals(null, content.payoutAccount)
            assertEquals(null, content.payoutMethod)
        }

    // MARK: - Withdraw

    @Test
    fun withdraw_succeeds_and_refreshes() =
        runTest {
            stubPayouts(enabled = true)
            coEvery { repository.withdraw(any()) } returns
                NetworkResult.Success(WalletWithdrawResponse(success = true, message = "$847.50 withdrawal initiated."))
            val vm = vm()
            vm.load()
            vm.withdraw()
            assertEquals(
                WalletAction.WithdrawSucceeded("$847.50 withdrawal initiated."),
                vm.action.value,
            )
            coVerify { repository.withdraw(match { it.amount == 84_750L }) }
        }

    @Test
    fun withdraw_blocked_when_payouts_disabled() =
        runTest {
            stubPayouts(enabled = false)
            val vm = vm()
            vm.load()
            vm.withdraw()
            assertTrue(vm.action.value is WalletAction.WithdrawFailed)
            coVerify(exactly = 0) { repository.withdraw(any()) }
        }

    @Test
    fun withdraw_surfaces_server_error() =
        runTest {
            stubPayouts(enabled = true)
            coEvery { repository.withdraw(any()) } returns
                NetworkResult.Failure(NetworkError.Server(400, "Insufficient balance"))
            val vm = vm()
            vm.load()
            vm.withdraw()
            assertTrue(vm.action.value is WalletAction.WithdrawFailed)
        }

    // MARK: - Connect onboarding + dashboard

    @Test
    fun setup_payouts_emits_onboarding_open_url() =
        runTest {
            stubPayouts(enabled = false)
            coEvery { connectRepository.createAccount() } returns
                NetworkResult.Success(ConnectCreateAccountResponse(stripeAccountId = "acct_1"))
            coEvery { connectRepository.onboarding() } returns
                NetworkResult.Success(ConnectOnboardingResponse(onboardingUrl = "https://connect.stripe.com/setup/x"))
            val vm = vm()
            vm.events.test {
                vm.setupPayouts()
                val event = awaitItem()
                assertTrue(event is WalletEvent.OpenUrl)
                event as WalletEvent.OpenUrl
                assertEquals("https://connect.stripe.com/setup/x", event.url)
                assertTrue(event.refreshOnReturn)
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun open_dashboard_emits_dashboard_open_url() =
        runTest {
            coEvery { connectRepository.dashboard() } returns
                NetworkResult.Success(ConnectDashboardResponse(dashboardUrl = "https://connect.stripe.com/express/x"))
            val vm = vm()
            vm.events.test {
                vm.openDashboard()
                val event = awaitItem() as WalletEvent.OpenUrl
                assertEquals("https://connect.stripe.com/express/x", event.url)
                assertFalse(event.refreshOnReturn)
                cancelAndIgnoreRemainingEvents()
            }
        }
}
