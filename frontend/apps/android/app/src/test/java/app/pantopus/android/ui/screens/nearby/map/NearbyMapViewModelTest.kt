@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.nearby.map

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigsInBoundsResponse
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.ListingsInBoundsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.screens.gigs.GigFilterCriteria
import app.pantopus.android.ui.screens.gigs.GigsCategory
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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

/**
 * Covers the Nearby Map VM (T2.4): combined gigs + listings load,
 * category filter triggers a refetch, sort runs locally, pin↔card
 * selection mirror, and error fallback when both endpoints fail.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class NearbyMapViewModelTest {
    private val gigs: GigsRepository = mockk()
    private val listings: ListingsRepository = mockk()
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

    private fun gigConfirmed(id: String = "g1"): GigDto =
        GigDto(
            id = id,
            title = "Hang shelves",
            description = "Need shelves mounted.",
            price = 60.0,
            category = "handyman",
            status = "open",
            createdAt = "2026-05-14T08:00:00Z",
            userId = "u1",
            bidCount = 4,
            latitude = 40.749,
            longitude = -73.984,
        )

    private fun gigPending(): GigDto =
        gigConfirmed(id = "g2").copy(status = "pending", category = "cleaning", latitude = 40.747, longitude = -73.986)

    private fun listing(): ListingDto =
        ListingDto(
            id = "l1",
            title = "Lightly-used couch",
            category = "moving",
            price = 250.0,
            latitude = 40.750,
            longitude = -73.985,
        )

    private fun makeVm(): NearbyMapViewModel = NearbyMapViewModel(gigs, listings, location)

    @Test fun load_combines_gigs_and_listings() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed(), gigPending())))
            coEvery { listings.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ListingsInBoundsResponse(listOf(listing())))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as NearbyMapUiState.Loaded
            assertEquals(3, loaded.entities.size)
            assertEquals(2, loaded.entities.count { it.kind == MapEntityKind.Gig })
            assertEquals(1, loaded.entities.count { it.kind == MapEntityKind.Listing })
            val pending = loaded.entities.firstOrNull { it.id == "g2" }
            assertEquals(MapEntityState.Pending, pending?.state)
        }

    @Test fun load_falls_back_to_error_when_both_endpoints_fail() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { listings.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is NearbyMapUiState.Error)
        }

    @Test fun select_category_refetches() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), null) } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed(), gigPending())))
            coEvery { listings.inBounds(any(), any(), any(), any(), null) } returns
                NetworkResult.Success(ListingsInBoundsResponse(listOf(listing())))
            coEvery { gigs.inBounds(any(), any(), any(), any(), "handyman") } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed())))
            coEvery { listings.inBounds(any(), any(), any(), any(), "handyman") } returns
                NetworkResult.Success(ListingsInBoundsResponse(emptyList()))
            val vm = makeVm()
            vm.load()
            vm.selectCategory(GigsCategory.Handyman)
            assertEquals(GigsCategory.Handyman, vm.activeCategory.value)
            val loaded = vm.state.value as NearbyMapUiState.Loaded
            assertEquals(1, loaded.entities.size)
            assertEquals("g1", loaded.entities.first().id)
        }

    @Test fun select_entity_mirrors_selected_id() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed())))
            coEvery { listings.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ListingsInBoundsResponse(emptyList()))
            val vm = makeVm()
            vm.load()
            vm.selectEntity("g1")
            assertEquals("g1", (vm.state.value as NearbyMapUiState.Loaded).selectedId)
            vm.selectEntity(null)
            assertNull((vm.state.value as NearbyMapUiState.Loaded).selectedId)
        }

    @Test fun apply_entity_type_gigs_hides_listings() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed(), gigPending())))
            coEvery { listings.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ListingsInBoundsResponse(listOf(listing())))
            val vm = makeVm()
            vm.load()
            assertEquals(3, (vm.state.value as NearbyMapUiState.Loaded).entities.size)
            vm.applyFilters(MapFilterCriteria(entityType = MapEntityType.Gigs))
            val loaded = vm.state.value as NearbyMapUiState.Loaded
            assertEquals(2, loaded.entities.size)
            assertTrue(loaded.entities.all { it.kind == MapEntityKind.Gig })
        }

    @Test fun apply_entity_type_listings_hides_gigs() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed(), gigPending())))
            coEvery { listings.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ListingsInBoundsResponse(listOf(listing())))
            val vm = makeVm()
            vm.load()
            vm.applyFilters(MapFilterCriteria(entityType = MapEntityType.Listings))
            val loaded = vm.state.value as NearbyMapUiState.Loaded
            assertEquals(listOf("l1"), loaded.entities.map { it.id })
        }

    @Test fun apply_category_filter_applies_to_gigs_and_listings() =
        runTest {
            coEvery { gigs.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GigsInBoundsResponse(listOf(gigConfirmed(), gigPending())))
            coEvery { listings.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ListingsInBoundsResponse(listOf(listing())))
            val vm = makeVm()
            vm.load()
            // g1 is handyman; g2 is cleaning; l1 is moving → only g1 survives.
            vm.applyFilters(MapFilterCriteria(gig = GigFilterCriteria(categories = setOf(GigsCategory.Handyman))))
            val loaded = vm.state.value as NearbyMapUiState.Loaded
            assertEquals(listOf("g1"), loaded.entities.map { it.id })
        }

    @Test fun sheet_stop_transitions() {
        val vm = makeVm()
        assertEquals(SheetStop.Standard, vm.sheetStop.value)
        vm.setSheetStop(SheetStop.Expanded)
        assertEquals(SheetStop.Expanded, vm.sheetStop.value)
        vm.setSheetStop(SheetStop.Collapsed)
        assertEquals(SheetStop.Collapsed, vm.sheetStop.value)
    }

    @Test fun cluster_merges_nearby_pins_and_keeps_lone_ones_as_entities() {
        // Two entities inside the same 0.005° bucket and one ~2 km
        // away → expect 1 cluster + 1 entity marker.
        val nearbyA =
            MapEntity(
                id = "a",
                kind = MapEntityKind.Gig,
                category = app.pantopus.android.ui.screens.gigs.GigsCategory.Handyman,
                state = MapEntityState.Confirmed,
                latitude = 40.7484,
                longitude = -73.9857,
                title = "A",
                summary = null,
                price = null,
                distanceLabel = null,
                bidCount = 0,
            )
        val nearbyB = nearbyA.copy(id = "b", latitude = 40.7486, longitude = -73.9855)
        val lone =
            nearbyA.copy(
                id = "c",
                kind = MapEntityKind.Listing,
                category = app.pantopus.android.ui.screens.gigs.GigsCategory.Moving,
                latitude = 40.7600,
                longitude = -73.9700,
            )
        val markers = NearbyMapViewModel.cluster(listOf(nearbyA, nearbyB, lone), 0.005)
        assertEquals(2, markers.size)
        val clusters = markers.filterIsInstance<MapMarker.Cluster>()
        val entitiesOnly = markers.filterIsInstance<MapMarker.Entity>()
        assertEquals(1, clusters.size)
        assertEquals(2, clusters.first().cluster.count)
        assertEquals(setOf("a", "b"), clusters.first().cluster.entityIds.toSet())
        assertEquals("c", entitiesOnly.first().entity.id)
    }
}
