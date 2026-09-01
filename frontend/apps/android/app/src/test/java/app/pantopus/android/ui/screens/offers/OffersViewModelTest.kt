@file:Suppress("LongMethod", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.offers

import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.BidGigDto
import app.pantopus.android.data.api.models.offers.BidderUserDto
import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.offers.ReceivedOffersResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class OffersViewModelTest {
    private val repo: OffersRepository = mockk()

    // Accept / reject route through the gig bid endpoints, not the offers ones.
    private val gigsRepo: GigsRepository = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** 2026-05-15 12:00:00 UTC — Friday. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    private fun dto(
        id: String,
        status: String? = "pending",
        counterAmount: Double? = null,
        createdAt: String? = null,
        expiresAt: String? = null,
        bidAmount: Double? = 100.0,
        askingPrice: Double? = null,
        category: String? = "handyman",
        bidder: BidderUserDto? = null,
    ) = BidDto(
        id = id,
        gigId = "g_$id",
        userId = "u",
        bidAmount = bidAmount,
        message = null,
        proposedTime = null,
        status = status,
        createdAt = createdAt,
        updatedAt = null,
        expiresAt = expiresAt,
        counterAmount = counterAmount,
        counterStatus = null,
        counteredAt = null,
        withdrawnAt = null,
        gig =
            BidGigDto(
                id = "g_$id",
                title = "Gig title",
                description = null,
                price = askingPrice,
                category = category,
                status = "open",
                userId = "u_owner",
            ),
        bidder = bidder,
    )

    private val oneReceived =
        ReceivedOffersResponse(
            offers =
                listOf(
                    dto(
                        id = "r1",
                        status = "pending",
                        createdAt = "2026-05-15T11:48:00Z",
                        bidAmount = 220.0,
                        askingPrice = 240.0,
                        category = "moving",
                        bidder =
                            BidderUserDto(
                                id = "u_other",
                                username = "anika",
                                name = "Anika R.",
                                city = "Mid-City",
                            ),
                    ),
                ),
            total = 1,
        )

    private val oneSent =
        MyBidsResponse(
            bids =
                listOf(
                    dto(
                        id = "s1",
                        status = "pending",
                        createdAt = "2026-05-13T09:00:00Z",
                        bidAmount = 50.0,
                        askingPrice = 45.0,
                        category = "cleaning",
                    ),
                ),
            total = 1,
        )

    private val emptyReceived = ReceivedOffersResponse(offers = emptyList(), total = 0)
    private val emptySent = MyBidsResponse(bids = emptyList(), total = 0)

    // MARK: - Lifecycle

    @Test
    fun load_populated_transitions_to_loaded_on_received_tab() =
        runTest {
            coEvery { repo.receivedOffers(any()) } returns NetworkResult.Success(oneReceived)
            coEvery { repo.myBids(any()) } returns NetworkResult.Success(oneSent)
            val vm = OffersViewModel(repo, gigsRepo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.firstOrNull()?.rows?.size)
            assertEquals("r1", loaded.sections.first().rows.first().id)
            assertEquals(1, vm.tabs.value[0].count)
            assertEquals(1, vm.tabs.value[1].count)
        }

    @Test
    fun load_empty_received_tab_renders_post_task_cta() =
        runTest {
            coEvery { repo.receivedOffers(any()) } returns NetworkResult.Success(emptyReceived)
            coEvery { repo.myBids(any()) } returns NetworkResult.Success(emptySent)
            val vm = OffersViewModel(repo, gigsRepo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No offers yet", empty.headline)
            assertEquals("Post a task", empty.ctaTitle)
        }

    @Test
    fun selecting_sent_tab_with_empty_lists_switches_cta() =
        runTest {
            coEvery { repo.receivedOffers(any()) } returns NetworkResult.Success(emptyReceived)
            coEvery { repo.myBids(any()) } returns NetworkResult.Success(emptySent)
            val vm = OffersViewModel(repo, gigsRepo)
            vm.load()
            vm.selectTab(OffersTab.SENT)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No offers sent yet", empty.headline)
            assertEquals("Browse listings", empty.ctaTitle)
        }

    @Test
    fun load_failure_transitions_to_error_when_cold() =
        runTest {
            coEvery { repo.receivedOffers(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { repo.myBids(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = OffersViewModel(repo, gigsRepo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Error)
        }

    // MARK: - Status derivation (pure projections)

    @Test
    fun status_pending_with_counter_is_countered() {
        val bid = dto(id = "b", status = "pending", counterAmount = 185.0)
        val s = OffersViewModel.derivedStatus(bid, fixedNow)
        assertEquals(OfferStatus.Countered, s)
    }

    @Test
    fun status_pending_near_expiry_is_expiring() {
        val bid =
            dto(
                id = "b",
                status = "pending",
                createdAt = "2026-05-15T11:30:00Z",
                expiresAt = "2026-05-15T13:00:00Z",
            )
        val s = OffersViewModel.derivedStatus(bid, fixedNow)
        assertEquals(OfferStatus.Expiring, s)
    }

    @Test
    fun status_pending_recent_is_new() {
        val bid =
            dto(
                id = "b",
                status = "pending",
                createdAt = "2026-05-15T11:30:00Z",
            )
        val s = OffersViewModel.derivedStatus(bid, fixedNow)
        assertEquals(OfferStatus.New, s)
    }

    @Test
    fun status_pending_old_is_pending() {
        val bid =
            dto(
                id = "b",
                status = "pending",
                createdAt = "2026-05-12T11:30:00Z",
            )
        val s = OffersViewModel.derivedStatus(bid, fixedNow)
        assertEquals(OfferStatus.Pending, s)
    }

    @Test
    fun status_accepted_and_assigned_map_to_accepted() {
        assertEquals(
            OfferStatus.Accepted,
            OffersViewModel.derivedStatus(dto(id = "a", status = "accepted"), fixedNow),
        )
        assertEquals(
            OfferStatus.Accepted,
            OffersViewModel.derivedStatus(dto(id = "b", status = "assigned"), fixedNow),
        )
    }

    @Test
    fun status_rejected_maps_to_declined() {
        assertEquals(
            OfferStatus.Declined,
            OffersViewModel.derivedStatus(dto(id = "b", status = "rejected"), fixedNow),
        )
    }

    @Test
    fun status_pending_past_expiry_is_expired() {
        val bid =
            dto(
                id = "b",
                status = "pending",
                createdAt = "2026-05-12T11:30:00Z",
                expiresAt = "2026-05-15T11:00:00Z",
            )
        assertEquals(
            OfferStatus.Expired,
            OffersViewModel.derivedStatus(bid, fixedNow),
        )
    }

    // MARK: - Row mapping (pure projections)

    @Test
    fun received_row_has_category_gradient_leading_and_price_stack() {
        val bid =
            dto(
                id = "r1",
                status = "pending",
                createdAt = "2026-05-15T11:30:00Z",
                bidAmount = 220.0,
                askingPrice = 240.0,
                category = "moving",
                bidder =
                    BidderUserDto(
                        id = "u_other",
                        username = "anika",
                        name = "Anika R.",
                        city = "Mid-City",
                    ),
            )
        val row =
            OffersViewModel.row(
                dto = bid,
                perspective = OfferPerspective.Received,
                now = fixedNow,
            )
        val leading = row.leading
        assertTrue(leading is RowLeading.CategoryGradientIcon)
        assertEquals(PantopusIcon.Package, (leading as RowLeading.CategoryGradientIcon).icon)
        val trailing = row.trailing
        assertTrue(trailing is RowTrailing.PriceStack)
        val priceStack = trailing as RowTrailing.PriceStack
        assertEquals("$220", priceStack.amount)
        assertEquals("asking $240", priceStack.sublabel)
        assertEquals("From Anika R. · Mid-City · 30m", row.subtitle)
        assertEquals("New offer", row.chips?.firstOrNull()?.text)
    }

    @Test
    fun sent_row_omits_bidder_and_says_your_offer() {
        val bid =
            dto(
                id = "s1",
                status = "pending",
                createdAt = "2026-05-15T11:30:00Z",
                bidAmount = 50.0,
                askingPrice = 45.0,
                category = "cleaning",
            )
        val row =
            OffersViewModel.row(
                dto = bid,
                perspective = OfferPerspective.Sent,
                now = fixedNow,
            )
        assertTrue(
            "Sent subtitle should start with 'Your offer ·', got ${row.subtitle}",
            row.subtitle?.startsWith("Your offer ·") == true,
        )
    }

    @Test
    fun countered_row_surfaces_counter_in_meta_tail() {
        val bid =
            dto(
                id = "c1",
                status = "pending",
                counterAmount = 185.0,
                createdAt = "2026-05-13T11:00:00Z",
                bidAmount = 170.0,
                askingPrice = 195.0,
                category = "handyman",
            )
        val rowReceived =
            OffersViewModel.row(
                dto = bid,
                perspective = OfferPerspective.Received,
                now = fixedNow,
            )
        assertEquals("you countered $185", rowReceived.metaTail)
        val rowSent =
            OffersViewModel.row(
                dto = bid,
                perspective = OfferPerspective.Sent,
                now = fixedNow,
            )
        assertEquals("counter $185", rowSent.metaTail)
    }

    // MARK: - Top-bar & tabs

    @Test
    fun filter_top_bar_action_always_present() =
        runTest {
            val vm = OffersViewModel(repo, gigsRepo)
            assertNotNull(vm.topBarAction.value)
            assertEquals(PantopusIcon.Filter, vm.topBarAction.value?.icon)
            assertEquals(true, vm.topBarAction.value?.isEnabled)
        }

    @Test
    fun tabs_expose_received_and_sent_in_order() {
        val vm = OffersViewModel(repo, gigsRepo)
        assertEquals(2, vm.tabs.value.size)
        assertEquals(OffersTab.RECEIVED, vm.tabs.value[0].id)
        assertEquals("Received", vm.tabs.value[0].label)
        assertEquals(OffersTab.SENT, vm.tabs.value[1].id)
        assertEquals("Sent", vm.tabs.value[1].label)
    }

    @Test
    fun tab_switch_uses_local_lists_without_refetch() =
        runTest {
            coEvery { repo.receivedOffers(any()) } returns NetworkResult.Success(oneReceived)
            coEvery { repo.myBids(any()) } returns NetworkResult.Success(oneSent)
            val vm = OffersViewModel(repo, gigsRepo)
            vm.load()
            vm.selectTab(OffersTab.SENT)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals("s1", loaded.sections.first().rows.first().id)
        }
}
