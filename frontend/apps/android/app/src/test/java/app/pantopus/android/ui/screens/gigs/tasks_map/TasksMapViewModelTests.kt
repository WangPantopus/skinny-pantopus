@file:Suppress("PackageNaming", "MagicNumber", "LargeClass")

package app.pantopus.android.ui.screens.gigs.tasks_map

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.gigs.GigCreator
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigsInBoundsResponse
import app.pantopus.android.data.api.models.gigs.GigsNearestActivityCenter
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.gigs.GigsSort
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridRegion
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPinState
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A11.1 Tasks map view-model — live `GET /api/gigs/in-bounds` fetch +
 * projection, the client-side category filter, pin↔card selection sync,
 * sort, the "Search this area" state machine, client-side clustering,
 * and the empty-state widen → jump-to-activity ladder. Mirrors iOS
 * `TasksMapViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TasksMapViewModelTests {
    private val repo: GigsRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // Anchor is TasksMapSampleData.anchor (40.7484, -73.9857); coords are
    // placed so handyman-1 is the closest task. Posters are verified by
    // default — the pin-state semantic is verified→Confirmed (A11.1).
    @Suppress("LongParameterList")
    private fun gig(
        id: String,
        category: String,
        price: Double,
        lat: Double,
        lon: Double,
        bidCount: Int,
        verified: Boolean = true,
        payType: String? = null,
    ): GigDto =
        GigDto(
            id = id,
            title = "Task $id",
            price = price,
            category = category,
            status = "open",
            payType = payType,
            bidCount = bidCount,
            latitude = lat,
            longitude = lon,
            creator = GigCreator(id = "user-$id", verified = verified),
        )

    private val sampleGigs =
        listOf(
            gig("handyman-1", "handyman", 60.0, 40.749, -73.988, bidCount = 4),
            gig("cleaning-1", "cleaning", 180.0, 40.745, -73.982, bidCount = 1),
            gig("cleaning-2", "cleaning", 90.0, 40.752, -73.990, bidCount = 2),
            gig("petcare-1", "petcare", 22.0, 40.747, -73.984, bidCount = 0, payType = "per_walk"),
            gig("petcare-2", "petcare", 25.0, 40.750, -73.987, bidCount = 3, payType = "per_walk"),
            gig("moving-1", "moving", 80.0, 40.744, -73.983, bidCount = 5, verified = false),
            gig("tutoring-1", "tutoring", 40.0, 40.753, -73.991, bidCount = 6, verified = false),
        )

    private fun mockLocation(): LocationProvider {
        val coord = UserCoordinate(latitude = 40.7484, longitude = -73.9857, accuracyMeters = 100.0)
        return mockk {
            every { cachedCoordinate() } returns coord
            coEvery { requestCurrent(any()) } returns coord
        }
    }

    private fun vm(
        category: String? = null,
        gigs: List<GigDto> = sampleGigs,
        result: NetworkResult<GigsInBoundsResponse> = NetworkResult.Success(GigsInBoundsResponse(gigs)),
        location: LocationProvider = mockLocation(),
    ): TasksMapViewModel {
        coEvery { repo.inBounds(any(), any(), any(), any(), any()) } returns result
        return TasksMapViewModel(
            repo,
            location,
            SavedStateHandle(if (category != null) mapOf("category" to category) else emptyMap()),
        )
    }

    /** VM with a scripted sequence of in-bounds responses. */
    private fun vmSequenced(vararg results: NetworkResult<GigsInBoundsResponse>): TasksMapViewModel {
        coEvery { repo.inBounds(any(), any(), any(), any(), any()) } returnsMany results.toList()
        return TasksMapViewModel(repo, mockLocation(), SavedStateHandle())
    }

    private fun items(vm: TasksMapViewModel): List<TaskMapItem>? = (vm.state.value as? TasksMapUiState.Populated)?.items

    private fun region(
        lat: Double = 40.7484,
        lon: Double = -73.9857,
        latSpan: Double = TasksMapViewModel.DEFAULT_LAT_SPAN,
        lonSpan: Double = TasksMapViewModel.DEFAULT_LON_SPAN,
    ): MapListHybridRegion =
        MapListHybridRegion(
            centerLatitude = lat,
            centerLongitude = lon,
            latitudeSpan = latSpan,
            longitudeSpan = lonSpan,
        )

    private val emptyWithHint =
        NetworkResult.Success(
            GigsInBoundsResponse(
                gigs = emptyList(),
                nearestActivityCenter = GigsNearestActivityCenter(latitude = 40.76, longitude = -73.99),
            ),
        )
    private val emptyNoHint = NetworkResult.Success(GigsInBoundsResponse(emptyList()))
    private val populated = NetworkResult.Success(GigsInBoundsResponse(sampleGigs))

    // ── Fetch + projection ────────────────────────────────────────────

    @Test
    fun load_fetches_in_bounds_and_projects_with_closest_selection() =
        runTest {
            val vm = vm()
            vm.load()
            assertEquals(sampleGigs.size, items(vm)?.size)
            // Closest-first by default → handyman-1 leads + pulses.
            assertEquals("handyman-1", vm.selectedId.value)
            assertEquals(items(vm)?.first()?.id, vm.selectedId.value)
            assertEquals("$60", items(vm)?.first()?.price)
            assertEquals("$22/walk", items(vm)?.firstOrNull { it.id == "petcare-1" }?.price)
        }

    @Test
    fun load_drops_gigs_without_coordinates() =
        runTest {
            val noCoords = GigDto(id = "x", title = "No coords", category = "cleaning", status = "open")
            val vm = vm(gigs = listOf(sampleGigs.first(), noCoords))
            vm.load()
            assertEquals(listOf("handyman-1"), items(vm)?.map { it.id })
        }

    @Test
    fun load_empty_result_produces_empty() =
        runTest {
            val vm = vm(gigs = emptyList())
            vm.load()
            assertTrue(vm.state.value is TasksMapUiState.Empty)
            assertNull(vm.selectedId.value)
            assertTrue(vm.mapPins.value.isEmpty())
            assertTrue(vm.mapClusters.value.isEmpty())
        }

    @Test
    fun load_server_error_produces_error() =
        runTest {
            val vm = vm(result = NetworkResult.Failure(NetworkError.Server(500, null)))
            vm.load()
            assertTrue(vm.state.value is TasksMapUiState.Error)
        }

    @Test
    fun projection_body_carries_description_for_full_list() =
        runTest {
            val withBody = sampleGigs.first().copy(description = "Bring a drill.")
            val vm = vm(gigs = listOf(withBody))
            vm.load()
            assertEquals("Bring a drill.", items(vm)?.first()?.body)
        }

    // ── Pin-state semantic (A11.1: verified poster → Confirmed) ──────

    @Test
    fun pins_carry_pending_state_for_unverified_posters() =
        runTest {
            val vm = vm()
            vm.load()
            val pins = items(vm)?.map { it.toPin() } ?: emptyList()
            assertEquals(sampleGigs.size, pins.size)
            // moving-1 + tutoring-1 carry unverified posters → pending.
            assertEquals(2, pins.count { it.state == MapPinState.Pending })
        }

    @Test
    fun verified_resident_badge_counts_as_confirmed() =
        runTest {
            val badged =
                sampleGigs.first().copy(
                    creator = GigCreator(id = "u", verified = null, badges = listOf("verified_resident")),
                )
            val vm = vm(gigs = listOf(badged))
            vm.load()
            assertEquals(MapPinState.Confirmed, items(vm)?.first()?.state)
        }

    // ── Filters + sort (unchanged behavior) ───────────────────────────

    @Test
    fun category_filter_narrows_visible_items() =
        runTest {
            val vm = vm()
            vm.load()
            vm.selectCategory(GigsCategory.Cleaning)
            val visible = items(vm)
            assertEquals(2, visible?.size)
            assertTrue(visible?.all { it.category == GigsCategory.Cleaning } == true)
            assertEquals(visible?.first()?.id, vm.selectedId.value)
        }

    @Test
    fun category_with_no_matches_produces_empty() =
        runTest {
            val vm = vm()
            vm.load()
            vm.selectCategory(GigsCategory.Tech) // no tech task fetched
            assertTrue(vm.state.value is TasksMapUiState.Empty)
            assertNull(vm.selectedId.value)
        }

    @Test
    fun reselecting_all_restores_populated() =
        runTest {
            val vm = vm()
            vm.load()
            vm.selectCategory(GigsCategory.Tech)
            assertTrue(vm.state.value is TasksMapUiState.Empty)
            vm.selectCategory(GigsCategory.All)
            assertEquals(sampleGigs.size, items(vm)?.size)
        }

    @Test
    fun select_updates_selected_id() =
        runTest {
            val vm = vm()
            vm.load()
            vm.select("cleaning-1")
            assertEquals("cleaning-1", vm.selectedId.value)
        }

    @Test
    fun sort_fewest_bids_orders_ascending() =
        runTest {
            val vm = vm()
            vm.load()
            vm.selectSort(GigsSort.FewestBids)
            val bids = items(vm)?.map { it.bidCount } ?: emptyList()
            assertEquals(bids.sorted(), bids)
        }

    @Test
    fun sort_highest_pay_leads_with_priciest() =
        runTest {
            val vm = vm()
            vm.load()
            vm.selectSort(GigsSort.HighestPay)
            assertEquals("cleaning-1", items(vm)?.first()?.id) // $180
        }

    @Test
    fun initial_category_from_saved_state_applied_on_load() =
        runTest {
            val vm = vm(category = "petcare")
            vm.load()
            val visible = items(vm)
            assertEquals(2, visible?.size)
            assertTrue(visible?.all { it.category == GigsCategory.PetCare } == true)
            assertEquals(GigsCategory.PetCare, vm.activeCategory.value)
        }

    // ── Pin↔card sync ─────────────────────────────────────────────────

    @Test
    fun select_index_selects_and_pans_camera_preserving_span() =
        runTest {
            val vm = vm()
            vm.load()
            vm.cameraSettled(region()) // baseline sync (post-fetch)
            val target = items(vm)!![2]
            vm.selectIndex(2)
            assertEquals(target.id, vm.selectedId.value)
            val camera = vm.cameraTarget.value
            assertNotNull(camera)
            assertEquals(target.latitude, camera!!.region.centerLatitude, 1e-9)
            assertEquals(target.longitude, camera.region.centerLongitude, 1e-9)
            assertEquals(TasksMapViewModel.DEFAULT_LAT_SPAN, camera.region.latitudeSpan, 1e-9)
        }

    @Test
    fun select_index_same_selection_is_a_noop() =
        runTest {
            val vm = vm()
            vm.load()
            val before = vm.cameraTarget.value
            vm.selectIndex(0) // handyman-1 is already selected
            assertEquals(before, vm.cameraTarget.value)
        }

    @Test
    fun pin_tap_select_does_not_move_camera() =
        runTest {
            val vm = vm()
            vm.load()
            vm.select("cleaning-2")
            assertNull(vm.cameraTarget.value)
        }

    @Test
    fun selected_index_tracks_selection_in_sorted_order() =
        runTest {
            val vm = vm()
            vm.load()
            vm.select("cleaning-1")
            assertEquals(items(vm)?.indexOfFirst { it.id == "cleaning-1" }, vm.selectedIndex)
        }

    // ── Clustering ────────────────────────────────────────────────────

    @Test
    fun wide_span_clusters_dense_pins() =
        runTest {
            val vm = vm()
            vm.load()
            // Settle on a very wide region — every sample pin shares a cell.
            vm.cameraSettled(region(latSpan = 5.0, lonSpan = 5.0))
            assertTrue(vm.mapClusters.value.isNotEmpty())
            assertEquals(
                sampleGigs.size,
                vm.mapPins.value.size + vm.mapClusters.value.sumOf { it.count },
            )
        }

    @Test
    fun tight_span_declusters_to_singles() =
        runTest {
            val vm = vm()
            vm.load()
            vm.cameraSettled(region(latSpan = 0.0005, lonSpan = 0.0005))
            assertTrue(vm.mapClusters.value.isEmpty())
            assertEquals(sampleGigs.size, vm.mapPins.value.size)
        }

    @Test
    fun tap_cluster_zooms_halved_span_on_centroid() =
        runTest {
            val vm = vm()
            vm.load()
            vm.cameraSettled(region(latSpan = 5.0, lonSpan = 5.0))
            val cluster = vm.mapClusters.value.first()
            vm.tapCluster(cluster.id)
            val camera = vm.cameraTarget.value
            assertNotNull(camera)
            assertEquals(cluster.latitude, camera!!.region.centerLatitude, 1e-9)
            assertEquals(2.5, camera.region.latitudeSpan, 1e-9) // 5.0 halved
        }

    @Test
    fun focus_on_pins_fits_bounding_region() =
        runTest {
            val vm = vm()
            vm.load()
            vm.focusOnPins()
            val camera = vm.cameraTarget.value
            assertNotNull(camera)
            val lats = items(vm)!!.map { it.latitude }
            assertEquals((lats.min() + lats.max()) / 2, camera!!.region.centerLatitude, 1e-9)
        }

    // ── Search this area ──────────────────────────────────────────────

    @Test
    fun first_settle_after_fetch_adopts_baseline_without_pill() =
        runTest {
            val vm = vm()
            vm.load()
            // Camera settles on a fitted region that differs from the
            // fetch box — must NOT trigger the pill (baseline re-sync).
            vm.cameraSettled(region(lat = 40.7600, lonSpan = 0.05))
            assertFalse(vm.showsSearchThisArea.value)
        }

    @Test
    fun significant_move_after_baseline_shows_pill() =
        runTest {
            val vm = vm()
            vm.load()
            vm.cameraSettled(region()) // baseline
            vm.cameraSettled(region(lat = 40.7484 + 0.5)) // big pan
            assertTrue(vm.showsSearchThisArea.value)
        }

    @Test
    fun insignificant_move_keeps_pill_hidden() =
        runTest {
            val vm = vm()
            vm.load()
            vm.cameraSettled(region()) // baseline
            vm.cameraSettled(region(lat = 40.7484 + 0.001)) // tiny pan
            assertFalse(vm.showsSearchThisArea.value)
        }

    @Test
    fun search_this_area_refetches_and_rebaselines() =
        runTest {
            val vm = vmSequenced(populated, populated)
            vm.load()
            vm.cameraSettled(region()) // baseline
            val moved = region(lat = 40.7484 + 0.5)
            vm.cameraSettled(moved)
            assertTrue(vm.showsSearchThisArea.value)
            vm.searchThisArea()
            assertFalse(vm.showsSearchThisArea.value)
            // Post-fetch baseline re-sync: the next settle (camera fitting
            // the new viewport) must not re-trigger the pill.
            vm.cameraSettled(moved)
            assertFalse(vm.showsSearchThisArea.value)
        }

    @Test
    fun search_this_area_keeps_content_during_refetch() =
        runTest {
            val vm = vmSequenced(populated, populated)
            vm.load()
            vm.cameraSettled(region())
            vm.cameraSettled(region(lat = 41.5))
            vm.searchThisArea()
            // No skeleton flash — state stayed populated throughout.
            assertTrue(vm.state.value is TasksMapUiState.Populated)
        }

    // ── Widen → jump-to-activity ladder ───────────────────────────────

    @Test
    fun first_empty_load_with_hint_still_offers_widen() =
        runTest {
            val vm = vmSequenced(emptyWithHint)
            vm.load()
            assertTrue(vm.state.value is TasksMapUiState.Empty)
            assertEquals(0, vm.widenAttempts)
            assertTrue(vm.emptyAction.value is TasksMapEmptyAction.Widen)
        }

    @Test
    fun widened_refetch_still_empty_with_hint_escalates_to_jump() =
        runTest {
            val vm = vmSequenced(emptyWithHint, emptyWithHint)
            vm.load()
            vm.widenSearch()
            assertEquals(1, vm.widenAttempts)
            val action = vm.emptyAction.value
            assertTrue(action is TasksMapEmptyAction.JumpToActivity)
            assertEquals(40.76, (action as TasksMapEmptyAction.JumpToActivity).latitude, 1e-9)
        }

    @Test
    fun widen_zooms_camera_out_2_5x() =
        runTest {
            val vm = vmSequenced(emptyNoHint, emptyNoHint)
            vm.load()
            vm.cameraSettled(region()) // baseline at default span
            vm.widenSearch()
            val camera = vm.cameraTarget.value
            assertNotNull(camera)
            assertEquals(TasksMapViewModel.DEFAULT_LAT_SPAN * 2.5, camera!!.region.latitudeSpan, 1e-9)
        }

    @Test
    fun widened_refetch_empty_without_hint_keeps_widen() =
        runTest {
            val vm = vmSequenced(emptyNoHint, emptyNoHint)
            vm.load()
            vm.widenSearch()
            assertTrue(vm.emptyAction.value is TasksMapEmptyAction.Widen)
        }

    @Test
    fun populated_fetch_resets_the_ladder() =
        runTest {
            val vm = vmSequenced(emptyWithHint, populated)
            vm.load()
            vm.widenSearch()
            assertEquals(0, vm.widenAttempts)
            assertNull(vm.nearestActivityCenter)
            assertTrue(vm.state.value is TasksMapUiState.Populated)
        }

    @Test
    fun jump_to_activity_recenters_camera_on_hint_and_refetches() =
        runTest {
            val vm = vmSequenced(emptyWithHint, emptyWithHint, populated)
            vm.load()
            vm.widenSearch() // escalates
            vm.jumpToActivity()
            assertTrue(vm.state.value is TasksMapUiState.Populated)
            val camera = vm.cameraTarget.value
            assertNotNull(camera)
            assertEquals(40.76, camera!!.region.centerLatitude, 1e-9)
            assertEquals(TasksMapViewModel.DEFAULT_LAT_SPAN, camera.region.latitudeSpan, 1e-9)
        }
}
