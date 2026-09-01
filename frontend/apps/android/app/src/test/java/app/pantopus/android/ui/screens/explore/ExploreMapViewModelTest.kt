@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.explore

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigsInBoundsResponse
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.ListingsInBoundsResponse
import app.pantopus.android.data.api.models.postsmap.PostsMapResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.postsmap.PostsMapRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A11.2 Explore / P1-F — local projection (filters, clustering, selection) over
 * sample scenarios, plus the live gigs + listings in-bounds projection.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ExploreMapViewModelTest {
    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): ExploreMapViewModel = ExploreMapViewModel(mockk(), mockk(), mockk(), mockk())

    private fun loaded(vm: ExploreMapViewModel): ExploreMapUiState.Loaded = vm.state.value as ExploreMapUiState.Loaded

    @Test
    fun populated_load_projects47Entities_withThreeActiveFilters() {
        val vm = makeVm()
        vm.load(ExploreScenario.Populated)
        val loaded = loaded(vm)
        assertEquals(47, loaded.entities.size)
        assertFalse(loaded.isEmpty)
        assertEquals(3, vm.filters.value.activeCount)
    }

    @Test
    fun populated_markers_containAtLeastOneCluster() {
        val vm = makeVm()
        vm.load(ExploreScenario.Populated)
        assertTrue(loaded(vm).markers.any { it is ExploreMarker.Cluster })
    }

    @Test
    fun empty_load_isEmpty() {
        val vm = makeVm()
        vm.load(ExploreScenario.Empty)
        assertTrue(loaded(vm).isEmpty)
        assertEquals(3, vm.filters.value.activeCount)
    }

    @Test
    fun clearFilters_fromEmpty_revealsAllEntities() {
        val vm = makeVm()
        vm.load(ExploreScenario.Empty)
        vm.clearFilters()
        assertEquals(6, loaded(vm).entities.size)
        assertEquals(0, vm.filters.value.activeCount)
        assertNull(vm.activeKind.value)
    }

    @Test
    fun widenArea_fromEmpty_surfacesFartherNeighbors() {
        val vm = makeVm()
        vm.load(ExploreScenario.Empty)
        vm.widenArea()
        val entities = loaded(vm).entities
        assertEquals(3, entities.size)
        assertTrue(entities.all { it.verified && it.openNow })
    }

    @Test
    fun selectKind_filtersToSingleKind() {
        val vm = makeVm()
        vm.load(ExploreScenario.Populated)
        vm.selectKind(ExploreKind.Spot)
        val entities = loaded(vm).entities
        assertTrue(entities.isNotEmpty())
        assertTrue(entities.all { it.kind == ExploreKind.Spot })
    }

    @Test
    fun applyFilters_narrowsAndUpdatesActiveCount() {
        val vm = makeVm()
        vm.load(ExploreScenario.Populated)
        vm.applyFilters(
            ExploreFilterCriteria(
                kinds = setOf(ExploreKind.Task),
                distanceUpper = 1f,
                verifiedOnly = true,
                openNow = true,
            ),
        )
        assertTrue(loaded(vm).entities.all { it.kind == ExploreKind.Task })
        assertEquals(4, vm.filters.value.activeCount)
    }

    @Test
    fun selectEntity_setsSelectedId() {
        val vm = makeVm()
        vm.load(ExploreScenario.Populated)
        val first = loaded(vm).entities.first()
        vm.selectEntity(first.id)
        assertEquals(first.id, loaded(vm).selectedId)
    }

    @Test
    fun errorScenario_rendersError() {
        val vm = makeVm()
        vm.load(ExploreScenario.Error)
        assertTrue(vm.state.value is ExploreMapUiState.Error)
    }

    @Test
    fun loadingScenario_staysLoading() {
        val vm = makeVm()
        vm.load(ExploreScenario.Loading)
        assertTrue(vm.state.value is ExploreMapUiState.Loading)
    }

    // Live in-bounds projection

    @Test
    fun project_maps_gigs_and_listings() {
        val anchor = UserCoordinate(40.7484, -73.9857, 50.0)
        val entities =
            ExploreMapViewModel.project(
                gigs =
                    listOf(
                        GigDto(
                            id = "g1",
                            title = "Mow",
                            price = 40.0,
                            status = "open",
                            latitude = 40.75,
                            longitude = -73.98,
                            bidCount = 3,
                        ),
                    ),
                listings =
                    listOf(ListingDto(id = "l1", title = "Bike", price = 120.0, latitude = 40.751, longitude = -73.981)),
                anchor = anchor,
            )
        assertEquals(2, entities.size)
        val task = entities.first { it.kind == ExploreKind.Task }
        assertEquals("$40", task.metaLead)
        assertEquals("3 bids", task.badge?.text)
        val item = entities.first { it.kind == ExploreKind.Item }
        assertEquals("$120", item.metaLead)
    }

    @Test
    fun distanceMiles_approx() {
        val miles =
            ExploreMapViewModel.distanceMiles(UserCoordinate(40.7484, -73.9857, 50.0), 40.7584, -73.9857)
        assertEquals(0.69, miles, 0.1)
    }

    @Test
    fun liveLoadProjectsGigsAndListings() =
        runTest {
            val gigsRepo: GigsRepository = mockk()
            val listingsRepo: ListingsRepository = mockk()
            val location: LocationProvider = mockk()
            every { location.cachedCoordinate() } returns UserCoordinate(40.7484, -73.9857, 50.0)
            coEvery { gigsRepo.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    GigsInBoundsResponse(
                        listOf(
                            GigDto(
                                id = "g1",
                                title = "Mow lawn",
                                price = 40.0,
                                status = "open",
                                latitude = 40.75,
                                longitude = -73.98,
                                bidCount = 3,
                            ),
                        ),
                    ),
                )
            coEvery { listingsRepo.inBounds(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ListingsInBoundsResponse(
                        listOf(ListingDto(id = "l1", title = "Road bike", price = 120.0, latitude = 40.751, longitude = -73.981)),
                    ),
                )

            val postsMapRepo: PostsMapRepository = mockk()
            coEvery {
                postsMapRepo.markers(any(), any(), any(), any(), any(), any(), any(), any())
            } returns NetworkResult.Success(PostsMapResponse(markers = emptyList()))

            val vm = ExploreMapViewModel(gigsRepo, listingsRepo, postsMapRepo, location)
            vm.load()

            val loaded = vm.state.value as ExploreMapUiState.Loaded
            assertEquals(2, loaded.entities.size)
        }

    // Filter-criteria value type

    @Test
    fun filterCriteria_sectionsRoundTrip() {
        val original =
            ExploreFilterCriteria(
                kinds = setOf(ExploreKind.Task, ExploreKind.Spot),
                distanceUpper = 1f,
                verifiedOnly = true,
                openNow = false,
            )
        assertEquals(original, ExploreFilterCriteria.fromSections(original.toSections()))
    }

    @Test
    fun filterCriteria_activeCount_emptyAndAllAreInactive() {
        assertEquals(0, ExploreFilterCriteria().activeCount)
        val allKinds = ExploreFilterCriteria(kinds = ExploreKind.entries.toSet())
        assertFalse(allKinds.isKindActive)
        assertEquals(0, allKinds.activeCount)
    }

    @Test
    fun filterCriteria_matches_honoursEveryDimension() {
        val entity =
            ExploreEntity(
                id = "x",
                kind = ExploreKind.Task,
                state = ExploreEntityState.Confirmed,
                latitude = 0.0,
                longitude = 0.0,
                title = "Task",
                metaLead = "$1",
                distanceLabel = "0.2 mi",
                distanceMiles = 0.2,
                badge = null,
                verified = false,
                openNow = true,
            )
        assertTrue(ExploreFilterCriteria().matches(entity))
        assertFalse(ExploreFilterCriteria(kinds = setOf(ExploreKind.Spot)).matches(entity))
        assertFalse(ExploreFilterCriteria(distanceUpper = 0.1f).matches(entity))
        assertFalse(ExploreFilterCriteria(verifiedOnly = true).matches(entity))
    }
}
