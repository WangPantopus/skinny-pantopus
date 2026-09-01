@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.marketplace

import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.ListingsNearbyResponse
import app.pantopus.android.data.api.models.listings.ListingsPagination
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors the iOS MarketplaceViewModelTests: load → loaded/empty/error,
 * category chip drives a refetch, projection produces "Free" + suppresses
 * the condition badge for rentals/free, search submit refetches.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MarketplaceViewModelTest {
    private val repo: ListingsRepository = mockk()
    private val location: LocationProvider = mockk()
    private val center = UserCoordinate(40.7484, -73.9857, 50.0)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { location.cachedCoordinate() } returns center
        coEvery { location.requestCurrent(any()) } returns center
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun goodsListing(): ListingDto =
        ListingDto(
            id = "l1",
            title = "Mid-century sofa, walnut frame",
            price = 320.0,
            isFree = false,
            category = "furniture",
            condition = "like_new",
            status = "active",
            mediaUrls = emptyList(),
            firstImage = null,
            layer = "goods",
            listingType = "sell_item",
            distanceMeters = 644.0,
            createdAt = "2026-05-14T08:00:00Z",
        )

    private fun freeListing(): ListingDto =
        ListingDto(
            id = "l2",
            title = "Moving boxes — bundle of 18",
            price = 0.0,
            isFree = true,
            category = "free_stuff",
            condition = null,
            status = "active",
            layer = "goods",
            listingType = "free_item",
            distanceMeters = 160.0,
            createdAt = "2026-05-14T09:00:00Z",
        )

    private fun rentalListing(): ListingDto =
        ListingDto(
            id = "l3",
            title = "Peloton Bike+ (rental, week)",
            price = 45.0,
            isFree = false,
            category = "sports_outdoors",
            condition = "good",
            status = "active",
            layer = "rentals",
            listingType = "rent_sublet",
            distanceMeters = 1280.0,
            createdAt = "2026-05-13T08:00:00Z",
        )

    private fun makeVm(): MarketplaceViewModel = MarketplaceViewModel(repo, location)

    @Test fun load_with_listings_transitions_loaded() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing(), freeListing(), rentalListing())))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MarketplaceUiState.Loaded
            assertEquals(3, loaded.rows.size)
            val sofa = loaded.rows.first { it.id == "l1" }
            assertEquals("$320", sofa.price)
            assertEquals("Like new", sofa.conditionBadge)
            val freebie = loaded.rows.first { it.id == "l2" }
            assertEquals("Free", freebie.price)
            assertTrue(freebie.isFree)
            assertNull(freebie.conditionBadge)
            val rental = loaded.rows.first { it.id == "l3" }
            assertEquals("$45 / wk", rental.price)
            assertNull(rental.conditionBadge)
        }

    @Test fun load_empty_transitions_empty_with_radius() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(emptyList()))
            val vm = makeVm()
            vm.configureRadius(5.0)
            vm.load()
            val empty = vm.state.value as MarketplaceUiState.Empty
            assertEquals(5.0, empty.radiusMiles, 0.0)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is MarketplaceUiState.Error)
        }

    @Test fun select_category_refetches() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), null, null, any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing(), freeListing(), rentalListing())))
            coEvery {
                repo.nearby(any(), any(), any(), null, true, any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(freeListing())))
            val vm = makeVm()
            vm.load()
            vm.selectCategory(MarketplaceCategory.Free)
            assertEquals(MarketplaceCategory.Free, vm.activeCategory.value)
            val loaded = vm.state.value as MarketplaceUiState.Loaded
            assertEquals(1, loaded.rows.size)
            assertTrue(loaded.rows.first().isFree)
        }

    @Test fun submit_search_refetches() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), null, any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing())))
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), "bike", any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(rentalListing())))
            val vm = makeVm()
            vm.load()
            vm.setSearchText("bike")
            vm.submitSearch()
            val loaded = vm.state.value as MarketplaceUiState.Loaded
            assertEquals("l3", loaded.rows.first().id)
        }

    // MARK: - Generation-counted fetches (iOS parity)

    @Test fun chip_tap_during_inflight_load_refetches_and_stale_response_is_discarded() =
        runTest {
            val firstGate = CompletableDeferred<Unit>()
            coEvery {
                repo.nearby(any(), any(), any(), null, null, any(), any(), any(), any())
            } coAnswers {
                firstGate.await()
                NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing(), rentalListing())))
            }
            coEvery {
                repo.nearby(any(), any(), any(), null, true, any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(freeListing())))
            val vm = makeVm()
            vm.load() // first fetch parks on the gate
            // The old `if (loading) return` guard dropped this refetch.
            vm.selectCategory(MarketplaceCategory.Free)
            val loaded = vm.state.value as MarketplaceUiState.Loaded
            assertEquals(listOf("l2"), loaded.rows.map { it.id })
            // Now the stale "All" response lands — it must not clobber Free.
            firstGate.complete(Unit)
            val after = vm.state.value as MarketplaceUiState.Loaded
            assertEquals(listOf("l2"), after.rows.map { it.id })
        }

    @Test fun category_switch_shows_loading_skeleton_not_stale_cards() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), null, null, any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing())))
            val gate = CompletableDeferred<Unit>()
            coEvery {
                repo.nearby(any(), any(), any(), "rentals", any(), any(), any(), any(), any())
            } coAnswers {
                gate.await()
                NetworkResult.Success(ListingsNearbyResponse(listOf(rentalListing())))
            }
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is MarketplaceUiState.Loaded)
            vm.selectCategory(MarketplaceCategory.Rentals)
            assertTrue("Chip tap must flip to the skeleton", vm.state.value is MarketplaceUiState.Loading)
            gate.complete(Unit)
            assertTrue(vm.state.value is MarketplaceUiState.Loaded)
        }

    @Test fun pull_to_refresh_keeps_grid_while_inflight() =
        runTest {
            val responses =
                ArrayDeque(
                    listOf(
                        NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing()))),
                    ),
                )
            val gate = CompletableDeferred<Unit>()
            var calls = 0
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } coAnswers {
                calls += 1
                if (calls == 1) {
                    responses.first()
                } else {
                    gate.await()
                    NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing(), freeListing())))
                }
            }
            val vm = makeVm()
            vm.load()
            vm.refresh()
            assertTrue("Refresh keeps the grid live", vm.state.value is MarketplaceUiState.Loaded)
            assertTrue(vm.isRefreshing.value)
            gate.complete(Unit)
            assertFalse(vm.isRefreshing.value)
            assertEquals(2, (vm.state.value as MarketplaceUiState.Loaded).rows.size)
        }

    @Test fun refresh_on_return_refetches_so_new_listing_appears() =
        runTest {
            var calls = 0
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } coAnswers {
                calls += 1
                if (calls == 1) {
                    NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing())))
                } else {
                    NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing(), freeListing())))
                }
            }
            val vm = makeVm()
            vm.load() // first composition
            assertEquals(1, (vm.state.value as MarketplaceUiState.Loaded).rows.size)
            vm.load() // popping back from the wizard / detail
            assertEquals(2, (vm.state.value as MarketplaceUiState.Loaded).rows.size)
            coVerify(exactly = 2) { repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any()) }
        }

    // MARK: - Pagination

    @Test fun load_more_appends_next_page_deduped_by_id() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), 0)
            } returns
                NetworkResult.Success(
                    ListingsNearbyResponse(
                        listings = listOf(goodsListing(), freeListing()),
                        pagination = ListingsPagination(hasMore = true),
                    ),
                )
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), 2)
            } returns
                NetworkResult.Success(
                    ListingsNearbyResponse(
                        // l2 overlaps the first page — must dedup.
                        listings = listOf(freeListing(), rentalListing()),
                        pagination = ListingsPagination(hasMore = false),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.loadMoreIfNeeded(currentId = "l2") // tail card composes
            val loaded = vm.state.value as MarketplaceUiState.Loaded
            assertEquals(listOf("l1", "l2", "l3"), loaded.rows.map { it.id })
            assertFalse(vm.isLoadingMore.value)
            // hasMore=false → another tail hit must not fetch again.
            vm.loadMoreIfNeeded(currentId = "l3")
            coVerify(exactly = 1) { repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), 2) }
        }

    @Test fun load_more_ignores_cards_far_from_tail() =
        runTest {
            val page = (1..10).map { goodsListing().copy(id = "g$it") }
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), 0)
            } returns
                NetworkResult.Success(
                    ListingsNearbyResponse(listings = page, pagination = ListingsPagination(hasMore = true)),
                )
            val vm = makeVm()
            vm.load()
            vm.loadMoreIfNeeded(currentId = "g2") // not within the last 4
            coVerify(exactly = 0) { repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), 10) }
        }

    // MARK: - Radius widening

    @Test fun widen_radius_steps_through_ladder_and_refetches() =
        runTest {
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } returns NetworkResult.Success(ListingsNearbyResponse(emptyList()))
            val vm = makeVm()
            vm.load()
            assertEquals(2.0, (vm.state.value as MarketplaceUiState.Empty).radiusMiles, 0.0)
            assertTrue(vm.canWidenRadius)
            vm.widenRadius()
            assertEquals(5.0, (vm.state.value as MarketplaceUiState.Empty).radiusMiles, 0.0)
            vm.widenRadius()
            assertEquals(10.0, (vm.state.value as MarketplaceUiState.Empty).radiusMiles, 0.0)
            vm.widenRadius()
            assertEquals(25.0, (vm.state.value as MarketplaceUiState.Empty).radiusMiles, 0.0)
            assertFalse("25 mi is the ceiling", vm.canWidenRadius)
            vm.widenRadius() // inert at max
            coVerify(exactly = 4) { repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any()) }
            coVerify(exactly = 1) { repo.nearby(any(), any(), 25.0, any(), any(), any(), any(), any(), any()) }
        }

    // MARK: - Cold load flag

    @Test fun has_loaded_once_flips_after_first_fetch_completes() =
        runTest {
            val gate = CompletableDeferred<Unit>()
            coEvery {
                repo.nearby(any(), any(), any(), any(), any(), any(), any(), any(), any())
            } coAnswers {
                gate.await()
                NetworkResult.Success(ListingsNearbyResponse(listOf(goodsListing())))
            }
            val vm = makeVm()
            assertFalse(vm.hasLoadedOnce)
            vm.load()
            assertFalse("Still cold while the first fetch is in flight", vm.hasLoadedOnce)
            gate.complete(Unit)
            assertTrue(vm.hasLoadedOnce)
        }
}
