@file:Suppress("PackageNaming", "FunctionNaming")

package app.pantopus.android.ui.screens.wallet

import app.pantopus.android.data.api.models.wallet.WalletBalanceResponse
import app.pantopus.android.data.api.models.wallet.WalletDto
import app.pantopus.android.data.api.models.wallet.WalletPendingReleaseResponse
import app.pantopus.android.data.api.models.wallet.WalletTransactionDto
import app.pantopus.android.data.api.models.wallet.WalletTransactionsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.wallet.WalletRepository
import io.mockk.coEvery
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A10.10 / P1-F — Covers the Wallet VM: the [setFixture] seam (populated vs.
 * hold projection) and the live read-path load() (balance + transactions +
 * pending-release → content, error surfaces Error).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class WalletViewModelTest {
    private val repository: WalletRepository = mockk()
    private val connectRepository: ConnectRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Default: no connected account → live-load tests don't need to wire it.
        coEvery { connectRepository.accountStatus() } returns
            NetworkResult.Failure(NetworkError.Server(404, "no account"))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // MARK: - Fixture seam

    @Test
    fun initial_state_is_loading() {
        val vm = WalletViewModel(repository, connectRepository)
        assertEquals(WalletUiState.Loading, vm.state.value)
    }

    @Test
    fun load_resolves_to_populated_for_populated_fixture() {
        val vm = WalletViewModel(repository, connectRepository)
        vm.setFixture(WalletSampleData.populated)
        vm.load()
        val state = vm.state.value
        assertTrue("expected Populated, got $state", state is WalletUiState.Populated)
        val content = (state as WalletUiState.Populated).content
        assertEquals("847.50", content.available)
        assertFalse(content.isOnHold)
    }

    @Test
    fun load_resolves_to_hold_when_state_present() {
        val vm = WalletViewModel(repository, connectRepository)
        vm.setFixture(WalletSampleData.onHold)
        vm.load()
        val state = vm.state.value
        assertTrue("expected Hold, got $state", state is WalletUiState.Hold)
        val content = (state as WalletUiState.Hold).content
        assertNotNull(content.holdState)
        assertEquals("Bank verification expired", content.holdState?.bannerHeadline)
    }

    // MARK: - Live read-path

    @Test
    fun live_load_populates_from_read_endpoints() =
        runTest {
            coEvery { repository.balance() } returns
                NetworkResult.Success(WalletBalanceResponse(WalletDto(id = "w1", balance = 84_750L)))
            coEvery { repository.transactions() } returns
                NetworkResult.Success(
                    WalletTransactionsResponse(
                        listOf(
                            WalletTransactionDto(
                                id = "tx-1",
                                type = "gig_income",
                                amount = 14_000L,
                                description = "Patio cleanup",
                                status = "completed",
                                createdAt = "2026-06-03T14:14:00.000Z",
                            ),
                        ),
                    ),
                )
            coEvery { repository.pendingRelease() } returns
                NetworkResult.Success(
                    WalletPendingReleaseResponse(totalPendingCents = 18_600L, inReviewCount = 2, releasingSoonCount = 1),
                )

            val vm = WalletViewModel(repository, connectRepository)
            vm.load()

            val state = vm.state.value
            assertTrue("expected Populated, got $state", state is WalletUiState.Populated)
            val content = (state as WalletUiState.Populated).content
            assertEquals("847.50", content.available)
            assertEquals("\$186.00", content.pending)
            assertEquals(1, content.activity.size)
            assertEquals("140.00", content.activity.first().amount)
        }

    @Test
    fun live_load_surfaces_error_on_balance_failure() =
        runTest {
            coEvery { repository.balance() } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val vm = WalletViewModel(repository, connectRepository)
            vm.load()

            assertTrue(vm.state.value is WalletUiState.Error)
        }

    // MARK: - Sample fixtures

    @Test
    fun populated_fixture_shape() {
        val content = WalletSampleData.populated
        assertEquals(7, content.activity.size)
        assertEquals("7421", content.payoutMethod?.last4)
        assertEquals("\$1,284.50", content.monthValue)
        assertEquals("Today", content.activity[0].day)
        assertEquals("Yesterday", content.activity[2].day)
    }

    @Test
    fun hold_fixture_shape() {
        val content = WalletSampleData.onHold
        assertNotNull(content.holdState)
        assertEquals(4, content.activity.size)
        assertTrue(content.taxDocs?.bodyText?.contains("1099-NEC") == true)
        assertEquals(
            "Re-verify your bank above to unlock payouts.",
            content.holdState?.withdrawFootnote,
        )
    }

    @Test
    fun activity_categories_cover_audit_palette() {
        val cats = WalletSampleData.populated.activity.map { it.category }.toSet()
        assertEquals(
            setOf(
                ActivityCategory.Cleaning,
                ActivityCategory.ChildCare,
                ActivityCategory.Handyman,
                ActivityCategory.PetCare,
                ActivityCategory.Bank,
                ActivityCategory.Fee,
            ),
            cats,
        )
    }

    @Test
    fun fee_row_flagged_and_outbound() {
        val fee = WalletSampleData.populated.activity.first { it.isFee }
        assertEquals(ActivityDirection.Out, fee.direction)
        assertEquals(ActivityCategory.Fee, fee.category)
    }
}
