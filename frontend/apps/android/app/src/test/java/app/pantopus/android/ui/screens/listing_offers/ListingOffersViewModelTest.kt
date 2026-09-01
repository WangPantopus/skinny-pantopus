@file:Suppress("LongMethod", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.listing_offers

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.listing_offers.ListingOfferDto
import app.pantopus.android.data.api.models.listing_offers.ListingOfferResponseEnvelope
import app.pantopus.android.data.api.models.listing_offers.ListingOfferUserDto
import app.pantopus.android.data.api.models.listing_offers.ListingOffersResponse
import app.pantopus.android.data.api.models.listings.ListingDetailResponse
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.listing_offers.ListingOffersRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.transaction_reviews.TransactionReviewsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class ListingOffersViewModelTest {
    private val offersRepo: ListingOffersRepository = mockk()
    private val listingsRepo: ListingsRepository = mockk()
    private val authRepo: AuthRepository = mockk(relaxed = true)
    private val txnReviewsRepo: TransactionReviewsRepository = mockk(relaxed = true)
    private val paymentsRepo: PaymentsRepository = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    private fun makeVm(): ListingOffersViewModel {
        val handle =
            SavedStateHandle(
                mapOf(
                    ListingOffersViewModel.LISTING_ID_KEY to "listing-1",
                    ListingOffersViewModel.LISTING_TITLE_HINT_KEY to "Mid-century walnut credenza",
                ),
            )
        val vm = ListingOffersViewModel(offersRepo, listingsRepo, authRepo, txnReviewsRepo, paymentsRepo, handle)
        vm.bindCallbacks(
            onShareListing = {},
            onOpenBuyer = {},
            onOpenTransaction = {},
            now = { fixedNow },
        )
        return vm
    }

    private val listing: ListingDto =
        ListingDto(
            id = "listing-1",
            userId = "u_me",
            title = "Mid-century walnut credenza",
            price = 250.0,
            isFree = false,
            category = "furniture",
            status = "active",
            layer = "goods",
            createdAt = "2026-05-11T12:00:00Z",
        )

    private fun offer(
        id: String,
        amount: Double,
        status: String,
        counterAmount: Double? = null,
        message: String? = null,
        createdAt: String = "2026-05-13T12:00:00Z",
        buyerFirst: String? = null,
        buyerLast: String? = null,
        buyerUsername: String? = null,
    ) = ListingOfferDto(
        id = id,
        listingId = "listing-1",
        buyerId = "u_$id",
        sellerId = "u_me",
        amount = amount,
        message = message,
        status = status,
        counterAmount = counterAmount,
        createdAt = createdAt,
        buyer =
            ListingOfferUserDto(
                id = "u_$id",
                firstName = buyerFirst,
                lastName = buyerLast,
                username = buyerUsername,
            ),
    )

    private val threeOffers: List<ListingOfferDto> =
        listOf(
            offer(
                id = "o-anika",
                amount = 240.0,
                status = "pending",
                message = "Love the dovetail joinery.",
                createdAt = "2026-05-15T11:48:00Z",
                buyerFirst = "Anika",
                buyerLast = "Reyes",
            ),
            offer(
                id = "o-marcus",
                amount = 225.0,
                status = "countered",
                counterAmount = 235.0,
                createdAt = "2026-05-13T12:00:00Z",
                buyerFirst = "Marcus",
                buyerLast = "Tate",
            ),
            offer(
                id = "o-daniel",
                amount = 175.0,
                status = "declined",
                createdAt = "2026-05-12T12:00:00Z",
                buyerUsername = "dan_k",
            ),
        )

    /**
     * Three pending offers with amount and recency deliberately crossed
     * so every sort yields a distinct order:
     *   - o-low-new : $100, newest (05-15)
     *   - o-mid-old : $200, oldest (05-10)
     *   - o-high-mid: $300, middle (05-13) — top offer, wins LEADING
     */
    private val sortFixture: List<ListingOfferDto> =
        listOf(
            offer(id = "o-low-new", amount = 100.0, status = "pending", createdAt = "2026-05-15T10:00:00Z"),
            offer(id = "o-mid-old", amount = 200.0, status = "pending", createdAt = "2026-05-10T10:00:00Z"),
            offer(id = "o-high-mid", amount = 300.0, status = "pending", createdAt = "2026-05-13T10:00:00Z"),
        )

    private fun loadedVm(offers: List<ListingOfferDto>): ListingOffersViewModel {
        coEvery { listingsRepo.detail(any()) } returns NetworkResult.Success(ListingDetailResponse(listing))
        coEvery { offersRepo.listOffers(any()) } returns NetworkResult.Success(ListingOffersResponse(offers))
        val vm = makeVm()
        vm.load()
        return vm
    }

    private fun loadedRowIds(vm: ListingOffersViewModel): List<String> {
        val state = vm.state.value
        return if (state is ListOfRowsUiState.Loaded) state.sections.first().rows.map { it.id } else emptyList()
    }

    // MARK: - Lifecycle

    @Test
    fun load_populated_transitions_to_loaded_sorted_by_amount() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue("Expected .Loaded, got $state", state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(3, loaded.sections.first().rows.size)
            assertEquals("o-anika", loaded.sections.first().rows[0].id)
            assertEquals("o-marcus", loaded.sections.first().rows[1].id)
            assertEquals("o-daniel", loaded.sections.first().rows[2].id)
        }

    @Test
    fun load_empty_renders_share_cta() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No offers on this listing yet", empty.headline)
            assertEquals("Share listing", empty.ctaTitle)
        }

    @Test
    fun listing_failure_causes_error() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "Server error"))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun offers_failure_causes_error() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "Server error"))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    // MARK: - Listing context header

    @Test
    fun listing_context_renders_title_ask_count_and_status() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val context = vm.listingContext.value
            assertNotNull(context)
            assertEquals("Mid-century walnut credenza", context!!.title)
            assertEquals("$250", context.askPrice)
            assertEquals(3, context.offerCount)
            assertEquals("Highest offer", context.sortLabel)
            assertEquals("Active", context.statusChip.label)
        }

    @Test
    fun listing_context_shows_loading_hint_before_fetch() {
        val vm = makeVm()
        assertEquals("Mid-century walnut credenza", vm.listingContext.value?.title)
        assertEquals("Loading…", vm.listingContext.value?.statusChip?.label)
    }

    // MARK: - Row mapping

    @Test
    fun pending_row_has_respond_footer() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val pending = rows.first { it.id == "o-anika" }
            assertEquals(2, pending.footer?.actions?.size)
            assertEquals("Counter", pending.footer!!.actions[0].title)
            assertEquals(CompactButtonVariant.Ghost, pending.footer!!.actions[0].variant)
            assertEquals("Accept", pending.footer!!.actions[1].title)
            assertEquals(CompactButtonVariant.Primary, pending.footer!!.actions[1].variant)
            assertEquals(RowHighlight.Leading, pending.highlight)
        }

    @Test
    fun countered_row_has_undo_counter_footer_and_counter_chip() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val countered = rows.first { it.id == "o-marcus" }
            assertEquals(2, countered.footer?.actions?.size)
            assertEquals("Withdraw counter", countered.footer!!.actions[0].title)
            assertEquals(CompactButtonVariant.Destructive, countered.footer!!.actions[0].variant)
            assertEquals("Send counter", countered.footer!!.actions[1].title)
            assertEquals(2, countered.chips?.size)
            assertEquals("Countered", countered.chips!![0].text)
            assertEquals("Your counter $235", countered.chips!![1].text)
        }

    @Test
    fun declined_row_has_no_footer() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val declined = rows.first { it.id == "o-daniel" }
            assertNull(declined.footer)
            assertEquals("Declined", declined.chips!![0].text)
        }

    @Test
    fun completed_row_has_review_footer() =
        runTest {
            val completed =
                offer(
                    id = "o-done",
                    amount = 240.0,
                    status = "completed",
                    buyerFirst = "Anika",
                    buyerLast = "Reyes",
                )
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(listOf(completed)))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val row = rows.first { it.id == "o-done" }
            assertEquals(2, row.footer?.actions?.size)
            assertEquals("View transaction", row.footer!!.actions[0].title)
            assertEquals("Leave a review", row.footer!!.actions[1].title)
        }

    @Test
    fun row_mapping_price_stack_and_buyer_name() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val row = rows.first()
            assertEquals("Anika Reyes", row.title)
            assertTrue(row.leading is RowLeading.AvatarWithBadge)
            val trailing = row.trailing as RowTrailing.PriceStack
            assertEquals("$240", trailing.amount)
            assertEquals("asking $250", trailing.sublabel)
        }

    @Test
    fun row_mapping_meta_tail_includes_age_and_index() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val marcus = rows.first { it.id == "o-marcus" }
            assertEquals("2 days old · 2 of 3 offers", marcus.metaTail)
        }

    // MARK: - Status mapping

    @Test
    fun status_from_raw_covers_known_variants() {
        assertEquals(ListingOfferStatus.Pending, ListingOfferStatus.fromRaw("pending"))
        assertEquals(ListingOfferStatus.Countered, ListingOfferStatus.fromRaw("countered"))
        assertEquals(ListingOfferStatus.Accepted, ListingOfferStatus.fromRaw("accepted"))
        assertEquals(ListingOfferStatus.Declined, ListingOfferStatus.fromRaw("declined"))
        assertEquals(ListingOfferStatus.Declined, ListingOfferStatus.fromRaw("rejected"))
        assertEquals(ListingOfferStatus.Expired, ListingOfferStatus.fromRaw("expired"))
        assertEquals(ListingOfferStatus.Withdrawn, ListingOfferStatus.fromRaw("withdrawn"))
        assertEquals(ListingOfferStatus.Completed, ListingOfferStatus.fromRaw("completed"))
        assertEquals(ListingOfferStatus.Pending, ListingOfferStatus.fromRaw("unknown"))
    }

    // MARK: - Optimistic mutations

    @Test
    fun accept_rolls_back_on_failure() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            coEvery { offersRepo.accept(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "Server error"))
            val vm = makeVm()
            vm.load()
            val dto = threeOffers.first { it.id == "o-anika" }
            vm.acceptOffer(dto)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(
                "Pending",
                state.sections.first().rows.first { it.id == "o-anika" }.chips!![0].text,
            )
        }

    @Test
    fun accept_confirms_on_success() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            coEvery { offersRepo.accept(any(), any()) } returns
                NetworkResult.Success(
                    ListingOfferResponseEnvelope(
                        ListingOfferDto(id = "o-anika", status = "accepted"),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.acceptOffer(threeOffers.first { it.id == "o-anika" })
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first { it.id == "o-anika" }
            assertEquals("Accepted", row.chips!![0].text)
            assertEquals(1, row.footer?.actions?.size)
            assertEquals("View transaction", row.footer!!.actions.first().title)
        }

    @Test
    fun accept_by_buyer_of_countered_offer_presents_checkout() =
        runTest {
            every { authRepo.state } returns
                MutableStateFlow(
                    AuthRepository.State.SignedIn(
                        UserDto(
                            id = "u_o-marcus",
                            email = "marcus@example.com",
                            displayName = "Marcus Tate",
                            avatarUrl = null,
                        ),
                    ),
                )
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            coEvery { offersRepo.accept(any(), any()) } returns
                NetworkResult.Success(
                    ListingOfferResponseEnvelope(
                        ListingOfferDto(id = "o-marcus", status = "accepted"),
                    ),
                )
            coEvery { paymentsRepo.createPaymentIntent(any()) } returns
                NetworkResult.Success(
                    PaymentIntentSheetParamsDto(
                        clientSecret = "pi_secret_1",
                        paymentIntentId = "pi_1",
                        customer = "cus_1",
                        ephemeralKey = "ek_1",
                        publishableKey = "pk_test",
                    ),
                )
            val vm = makeVm()
            vm.load()
            val events = mutableListOf<ListingOffersEvent>()
            backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
                vm.events.collect { events += it }
            }

            vm.acceptOffer(threeOffers.first { it.id == "o-marcus" })
            advanceUntilIdle()

            val event = events.single()
            assertTrue(event is ListingOffersEvent.PresentCheckout)
            assertEquals("pi_secret_1", (event as ListingOffersEvent.PresentCheckout).params.clientSecret)
        }

    @Test
    fun decline_confirms_on_success() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            coEvery { offersRepo.decline(any(), any()) } returns
                NetworkResult.Success(
                    ListingOfferResponseEnvelope(
                        ListingOfferDto(id = "o-anika", status = "declined"),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.declineOffer(threeOffers.first { it.id == "o-anika" })
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first { it.id == "o-anika" }
            assertEquals("Declined", row.chips!![0].text)
            assertNull(row.footer)
        }

    @Test
    fun counter_confirms_on_success() =
        runTest {
            coEvery { listingsRepo.detail(any()) } returns
                NetworkResult.Success(ListingDetailResponse(listing))
            coEvery { offersRepo.listOffers(any()) } returns
                NetworkResult.Success(ListingOffersResponse(threeOffers))
            coEvery { offersRepo.counter(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ListingOfferResponseEnvelope(
                        ListingOfferDto(id = "o-anika", status = "countered", counterAmount = 230.0),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.requestCounter(threeOffers.first { it.id == "o-anika" })
            assertNotNull(vm.counterTarget.value)
            vm.confirmCounter(amount = 230.0, message = null)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first { it.id == "o-anika" }
            assertEquals("Countered", row.chips!![0].text)
            assertEquals("Your counter $230", row.chips!![1].text)
        }

    // MARK: - Sort menu

    @Test
    fun default_sort_is_highest_offer() =
        runTest {
            val vm = loadedVm(sortFixture)
            assertEquals(listOf("o-high-mid", "o-mid-old", "o-low-new"), loadedRowIds(vm))
            assertEquals("Highest offer", vm.listingContext.value?.sortLabel)
        }

    @Test
    fun select_sort_lowest_offer() =
        runTest {
            val vm = loadedVm(sortFixture)
            vm.selectSort(ListingOffersSort.LowestOffer)
            assertEquals(listOf("o-low-new", "o-mid-old", "o-high-mid"), loadedRowIds(vm))
            assertEquals("Lowest offer", vm.listingContext.value?.sortLabel)
        }

    @Test
    fun select_sort_newest_first() =
        runTest {
            val vm = loadedVm(sortFixture)
            vm.selectSort(ListingOffersSort.NewestFirst)
            assertEquals(listOf("o-low-new", "o-high-mid", "o-mid-old"), loadedRowIds(vm))
            assertEquals("Newest first", vm.listingContext.value?.sortLabel)
        }

    @Test
    fun select_sort_oldest_first() =
        runTest {
            val vm = loadedVm(sortFixture)
            vm.selectSort(ListingOffersSort.OldestFirst)
            assertEquals(listOf("o-mid-old", "o-high-mid", "o-low-new"), loadedRowIds(vm))
            assertEquals("Oldest first", vm.listingContext.value?.sortLabel)
        }

    @Test
    fun leading_highlight_tracks_top_offer_regardless_of_sort() =
        runTest {
            val vm = loadedVm(sortFixture)
            vm.selectSort(ListingOffersSort.OldestFirst)
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val leading = rows.firstOrNull { it.highlight == RowHighlight.Leading }
            assertEquals("o-high-mid", leading?.id)
        }

    @Test
    fun sort_persists_across_refresh() =
        runTest {
            val vm = loadedVm(sortFixture)
            vm.selectSort(ListingOffersSort.LowestOffer)
            vm.refresh()
            assertEquals(listOf("o-low-new", "o-mid-old", "o-high-mid"), loadedRowIds(vm))
            assertEquals("Lowest offer", vm.listingContext.value?.sortLabel)
        }

    @Test
    fun sort_menu_options_expose_four_entries_with_selection() =
        runTest {
            val vm = loadedVm(sortFixture)
            val options = vm.listingContext.value?.sortOptions ?: emptyList()
            assertEquals(
                listOf("Highest offer", "Lowest offer", "Newest first", "Oldest first"),
                options.map { it.label },
            )
            assertEquals(listOf("highestOffer"), options.filter { it.isSelected }.map { it.id })
            vm.selectSort(ListingOffersSort.NewestFirst)
            val after = vm.listingContext.value?.sortOptions ?: emptyList()
            assertEquals(listOf("newestFirst"), after.filter { it.isSelected }.map { it.id })
        }
}
