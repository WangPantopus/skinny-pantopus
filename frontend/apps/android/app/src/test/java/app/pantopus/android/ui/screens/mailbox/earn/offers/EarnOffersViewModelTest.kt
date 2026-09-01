@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.earn.offers

import app.pantopus.android.data.api.models.earn.EarnOfferDto
import app.pantopus.android.data.api.models.earn.EarnOffersResponse
import app.pantopus.android.data.api.models.earn.EarnOpenOfferResponse
import app.pantopus.android.data.api.models.earn.EarnRevealOfferResponse
import app.pantopus.android.data.api.models.earn.EarnSaveOfferResponse
import app.pantopus.android.data.api.models.earn.EarnTransactionDto
import app.pantopus.android.data.api.models.mailbox.v2.EarnBalanceDto
import app.pantopus.android.data.api.models.mailbox.v2.EarnBalanceResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.earn.EarnOffersRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

/**
 * Earn drawer paid-offer wall. Mirrors the iOS
 * `EarnOffersViewModelTests`: the offers + balance projection, a balance
 * failure not taking the wall down, the empty / error states, and the
 * daily cap landing as the first-class `capNotice` rather than an error.
 */
class EarnOffersViewModelTest {
    private val repository: EarnOffersRepository = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun offers() =
        EarnOffersResponse(
            offers =
                listOf(
                    EarnOfferDto(
                        id = "offer_1",
                        businessName = "Corner Bakery",
                        businessInit = "CB",
                        businessColor = "#B45309",
                        offerTitle = "Free coffee with any pastry",
                        offerSubtitle = "Weekdays before 11am",
                        payoutAmount = BigDecimal("0.25"),
                        expiresAt = "2026-09-04T12:00:00Z",
                        status = "active",
                        opened = false,
                    ),
                    EarnOfferDto(
                        id = "offer_2",
                        businessName = "Ridgeline Hardware",
                        offerTitle = "\$10 off orders over \$50",
                        payoutAmount = BigDecimal("1.50"),
                        status = "active",
                        opened = true,
                        transaction =
                            EarnTransactionDto(
                                status = "verified",
                                dwellMs = 16_000,
                                amount = BigDecimal("1.50"),
                            ),
                    ),
                ),
        )

    private fun balance(
        total: Double = 1.75,
        available: Double = 0.25,
        pending: Double = 1.5,
    ) = EarnBalanceResponse(EarnBalanceDto(total = total, available = available, pending = pending))

    @Test
    fun load_projects_offers_and_server_balance() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(offers())
            coEvery { repository.balance() } returns NetworkResult.Success(balance())
            val vm = EarnOffersViewModel(repository)

            vm.load()

            val state = vm.state.value
            assertTrue("expected Loaded, got $state", state is EarnOffersUiState.Loaded)
            val loaded = state as EarnOffersUiState.Loaded
            assertEquals("1.75", loaded.balance.total)
            assertEquals("0.25", loaded.balance.available)
            assertEquals("1.50", loaded.balance.pending)
            assertTrue(loaded.balance.hasPending)

            assertEquals(2, loaded.offers.size)
            assertEquals("CB", loaded.offers[0].initials)
            assertEquals("25¢", loaded.offers[0].payoutLabel)
            assertEquals(EarnOfferEngagement.Unopened, loaded.offers[0].engagement)
            assertEquals("Offer expires Sep 4", loaded.offers[0].expiryLabel)

            assertEquals("RH", loaded.offers[1].initials)
            assertEquals("\$1.50", loaded.offers[1].payoutLabel)
            assertEquals("Limited time", loaded.offers[1].expiryLabel)
            assertEquals(EarnOfferEngagement.Earned, loaded.offers[1].engagement)
        }

    @Test
    fun balance_failure_still_renders_the_wall() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(offers())
            coEvery { repository.balance() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = EarnOffersViewModel(repository)

            vm.load()

            val state = vm.state.value as EarnOffersUiState.Loaded
            assertEquals(2, state.offers.size)
            assertEquals(EarnOffersBalance.Zero, state.balance)
        }

    @Test
    fun empty_offers_keeps_the_balance_hero() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(EarnOffersResponse())
            coEvery { repository.balance() } returns NetworkResult.Success(balance())
            val vm = EarnOffersViewModel(repository)

            vm.load()

            val state = vm.state.value
            assertTrue("expected Empty, got $state", state is EarnOffersUiState.Empty)
            assertEquals("1.75", (state as EarnOffersUiState.Empty).balance.total)
        }

    @Test
    fun offers_failure_surfaces_error() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { repository.balance() } returns NetworkResult.Success(balance())
            val vm = EarnOffersViewModel(repository)

            vm.load()

            assertTrue(vm.state.value is EarnOffersUiState.Error)
        }

    @Test
    fun daily_cap_lands_as_cap_notice_not_an_error() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(offers())
            coEvery { repository.balance() } returns NetworkResult.Success(balance())
            coEvery { repository.openOffer("offer_1") } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(429, """{"error":"Daily offer cap reached (10/day)","capped":true}"""),
                )
            val vm = EarnOffersViewModel(repository)
            vm.load()

            vm.open("offer_1")

            assertEquals("Daily cap reached", vm.capNotice.value?.headline)
            assertEquals("You can open up to 10 offers per day.", vm.capNotice.value?.body)
            assertNull(vm.toast.value)
            val state = vm.state.value as EarnOffersUiState.Loaded
            // The envelope stays sealed — nothing was banked.
            assertEquals(EarnOfferEngagement.Unopened, state.offers[0].engagement)

            vm.dismissCapNotice()
            assertNull(vm.capNotice.value)
        }

    @Test
    fun open_starts_the_dwell_window_and_reflects_the_server_balance() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(offers())
            coEvery { repository.balance() } returnsMany
                listOf(
                    NetworkResult.Success(balance()),
                    NetworkResult.Success(balance(total = 2.0, available = 0.25, pending = 1.75)),
                )
            coEvery { repository.openOffer("offer_1") } returns
                NetworkResult.Success(EarnOpenOfferResponse(message = "Offer opened", status = "pending"))
            val vm = EarnOffersViewModel(repository)
            vm.load()

            vm.open("offer_1")

            val state = vm.state.value as EarnOffersUiState.Loaded
            assertEquals(
                EarnOfferEngagement.Dwelling(EarnOfferDwell.SECONDS),
                state.offers[0].engagement,
            )
            // Not `0.25 + 1.75` computed locally — the server's total.
            assertEquals("2.00", state.balance.total)
            assertEquals("1.75", state.balance.pending)

            vm.cancelDwellTimers()
        }

    @Test
    fun save_confirms_with_a_toast() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(offers())
            coEvery { repository.balance() } returns NetworkResult.Success(balance())
            coEvery { repository.saveOffer("offer_1") } returns
                NetworkResult.Success(EarnSaveOfferResponse(message = "Offer saved"))
            val vm = EarnOffersViewModel(repository)
            vm.load()

            vm.save("offer_1")

            assertEquals("Offer saved", vm.toast.value?.text)
        }

    @Test
    fun reveal_surfaces_the_code() =
        runTest {
            coEvery { repository.offers() } returns NetworkResult.Success(offers())
            coEvery { repository.balance() } returns NetworkResult.Success(balance())
            coEvery { repository.revealOffer("offer_1") } returns
                NetworkResult.Success(EarnRevealOfferResponse(code = "BREW25"))
            val vm = EarnOffersViewModel(repository)
            vm.load()

            vm.reveal("offer_1")

            assertEquals("BREW25", vm.revealedCode.value?.code)
            assertEquals("Corner Bakery", vm.revealedCode.value?.businessName)

            vm.dismissRevealedCode()
            assertNull(vm.revealedCode.value)
        }
}
