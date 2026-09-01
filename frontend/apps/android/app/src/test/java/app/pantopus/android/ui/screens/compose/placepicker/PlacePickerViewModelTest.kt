package app.pantopus.android.ui.screens.compose.placepicker

import app.pantopus.android.data.api.models.geo.GeoNearbyPlacesResponse
import app.pantopus.android.data.api.models.geo.GeoPlace
import app.pantopus.android.data.api.models.geo.GeoPlaceCenter
import app.pantopus.android.data.api.models.geo.GeoPlaceSearchResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.place.PlaceRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Coverage for [PlacePickerViewModel] — mirrors the iOS
 * `PlacePickerViewModelTests`: nearby load, search-only degradation,
 * debounce coalescing, min-query short-circuit, empty + error states,
 * and proximity biasing.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlacePickerViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: PlaceRepository = mockk()

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(
        coordinate: UserCoordinate? = FIX,
        fixDelayMillis: Long = 0,
    ): PlacePickerViewModel = PlacePickerViewModel(repo, FakeLocationProvider(coordinate, fixDelayMillis))

    // MARK: - Nearby load

    @Test fun loadWithFixShowsNearbyAndLocality() =
        runTest {
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            val state = vm.state.value as PlacePickerUiState.Loaded
            assertEquals(listOf(POI), state.nearby)
            assertEquals(LOCALITY, state.locality)
            assertFalse(vm.searchOnly.value)
        }

    @Test fun loadWithoutFixEntersSearchOnlyMode() =
        runTest {
            val vm = viewModel(coordinate = null)
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.searchOnly.value)
            // Loaded (not Empty) — same render state as iOS's .loaded([], nil);
            // the sheet shows the search-only hint off the searchOnly flag.
            assertEquals(
                PlacePickerUiState.Loaded(nearby = emptyList(), locality = null),
                vm.state.value,
            )
            coVerify(exactly = 0) { repo.geoNearbyPlaces(any(), any()) }
        }

    @Test fun loadWithNoResultsStaysLoaded() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = emptyList(), locality = null))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            // The sheet renders "No places nearby" from the loaded state.
            assertEquals(
                PlacePickerUiState.Loaded(nearby = emptyList(), locality = null),
                vm.state.value,
            )
            assertFalse(vm.searchOnly.value)
        }

    @Test fun loadFailureSurfacesError() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is PlacePickerUiState.Error)
        }

    // MARK: - Search

    @Test fun searchDebounceCoalescesKeystrokes() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            coEvery { repo.geoSearchPlaces("coffee", FIX.latitude, FIX.longitude) } returns
                NetworkResult.Success(GeoPlaceSearchResponse(places = listOf(POI)))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            // Three quick keystrokes — only the final query should fire.
            vm.onQueryChange("cof")
            vm.onQueryChange("coffe")
            vm.onQueryChange("coffee")
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.geoSearchPlaces(any(), any(), any()) }
            coVerify(exactly = 1) { repo.geoSearchPlaces("coffee", FIX.latitude, FIX.longitude) }
            assertEquals(PlacePickerUiState.SearchResults(listOf(POI)), vm.state.value)
        }

    @Test fun shortQueryShortCircuitsToNearby() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            vm.onQueryChange("c")
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.geoSearchPlaces(any(), any(), any()) }
            assertTrue(vm.state.value is PlacePickerUiState.Loaded)
        }

    @Test fun clearingQueryRestoresNearbyWithoutRefetch() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            coEvery { repo.geoSearchPlaces(any(), any(), any()) } returns
                NetworkResult.Success(GeoPlaceSearchResponse(places = listOf(POI)))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            vm.onQueryChange("coffee")
            advanceUntilIdle()
            vm.onQueryChange("")
            advanceUntilIdle()
            assertTrue(vm.state.value is PlacePickerUiState.Loaded)
            coVerify(exactly = 1) { repo.geoNearbyPlaces(any(), any()) }
        }

    @Test fun emptySearchResultsShowEmpty() =
        runTest {
            coEvery { repo.geoSearchPlaces("nowhere", null, null) } returns
                NetworkResult.Success(GeoPlaceSearchResponse(places = emptyList()))
            val vm = viewModel(coordinate = null)
            vm.load()
            advanceUntilIdle()
            // No fix — search still works, with null proximity coords.
            vm.onQueryChange("nowhere")
            advanceUntilIdle()
            assertEquals(PlacePickerUiState.Empty, vm.state.value)
            coVerify(exactly = 1) { repo.geoSearchPlaces("nowhere", null, null) }
        }

    @Test fun searchFailureSurfacesErrorAndRetryReruns() =
        runTest {
            coEvery { repo.geoSearchPlaces("coffee", null, null) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(500, "down")),
                    NetworkResult.Success(GeoPlaceSearchResponse(places = listOf(POI))),
                )
            val vm = viewModel(coordinate = null)
            vm.load()
            advanceUntilIdle()
            vm.onQueryChange("coffee")
            advanceUntilIdle()
            assertTrue(vm.state.value is PlacePickerUiState.Error)
            vm.retry()
            advanceUntilIdle()
            assertEquals(PlacePickerUiState.SearchResults(listOf(POI)), vm.state.value)
        }

    @Test fun slowLoadDoesNotClobberActiveSearchResults() =
        runTest {
            // GPS fix takes 3s (virtual) — the user types meanwhile.
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            coEvery { repo.geoSearchPlaces("coffee", null, null) } returns
                NetworkResult.Success(GeoPlaceSearchResponse(places = listOf(POI)))
            val vm = viewModel(coordinate = FIX, fixDelayMillis = 3_000)
            vm.load()
            vm.onQueryChange("coffee")
            advanceUntilIdle()
            // The late-finishing load cached nearby but left the live
            // search results on screen.
            assertEquals(PlacePickerUiState.SearchResults(listOf(POI)), vm.state.value)
            vm.onQueryChange("")
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = LOCALITY),
                vm.state.value,
            )
        }

    @Test fun shortQueryAfterFailedLoadKeepsErrorState() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = viewModel()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is PlacePickerUiState.Error)
            // A 1-char query must not downgrade the Error card (and its
            // Retry) to Empty — nothing was cached to restore.
            vm.onQueryChange("c")
            advanceUntilIdle()
            assertTrue(vm.state.value is PlacePickerUiState.Error)
        }

    // MARK: - Media capture anchor (ADDENDUM 2)

    @Test fun mediaLocationDefaultsAnchorToPhotoAndLoadsWithoutGps() =
        runTest {
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            // No device fix at all — the photo anchor must not need one.
            val vm = viewModel(coordinate = null)
            vm.setMediaLocation(MEDIA)
            assertEquals(PlacePickerAnchor.Photo, vm.anchor.value)
            vm.load()
            advanceUntilIdle()
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = LOCALITY),
                vm.state.value,
            )
            assertFalse(vm.searchOnly.value)
            coVerify(exactly = 1) { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) }
        }

    @Test fun nullMediaLocationFallsBackToCurrentLocationFlow() =
        runTest {
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            val vm = viewModel()
            vm.setMediaLocation(null)
            assertEquals(PlacePickerAnchor.Current, vm.anchor.value)
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is PlacePickerUiState.Loaded)
            coVerify(exactly = 1) { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) }
        }

    @Test fun anchorSwitchReloadsAroundTheOtherAnchor() =
        runTest {
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = null))
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = emptyList(), locality = LOCALITY))
            val vm = viewModel()
            vm.setMediaLocation(MEDIA)
            vm.load()
            advanceUntilIdle()
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = null),
                vm.state.value,
            )

            vm.selectAnchor(PlacePickerAnchor.Current)
            advanceUntilIdle()
            assertEquals(
                PlacePickerUiState.Loaded(nearby = emptyList(), locality = LOCALITY),
                vm.state.value,
            )
            coVerify(exactly = 1) { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) }

            vm.selectAnchor(PlacePickerAnchor.Photo)
            advanceUntilIdle()
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = null),
                vm.state.value,
            )
            coVerify(exactly = 2) { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) }
        }

    @Test fun searchProximityFollowsActiveAnchor() =
        runTest {
            coEvery { repo.geoNearbyPlaces(any(), any()) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = null))
            coEvery { repo.geoSearchPlaces("coffee", any(), any()) } returns
                NetworkResult.Success(GeoPlaceSearchResponse(places = listOf(POI)))
            val vm = viewModel()
            vm.setMediaLocation(MEDIA)
            vm.load()
            advanceUntilIdle()

            vm.onQueryChange("coffee")
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.geoSearchPlaces("coffee", MEDIA.latitude, MEDIA.longitude) }

            // Chip switch mid-search: the active search is re-run with
            // the new anchor's proximity, never clobbered by the nearby
            // reload (same guard as the slow-GPS race).
            vm.selectAnchor(PlacePickerAnchor.Current)
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.geoSearchPlaces("coffee", FIX.latitude, FIX.longitude) }
            assertEquals(PlacePickerUiState.SearchResults(listOf(POI)), vm.state.value)
        }

    @Test fun nearMeWithoutFixShowsHintWhilePhotoAnchorStaysLive() =
        runTest {
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            val vm = viewModel(coordinate = null)
            vm.setMediaLocation(MEDIA)
            vm.load()
            advanceUntilIdle()
            assertFalse(vm.searchOnly.value)

            // "Near me" without a fix — today's search-only hint...
            vm.selectAnchor(PlacePickerAnchor.Current)
            advanceUntilIdle()
            assertTrue(vm.searchOnly.value)
            assertEquals(
                PlacePickerUiState.Loaded(nearby = emptyList(), locality = null),
                vm.state.value,
            )

            // ...while the photo chip stays fully functional.
            vm.selectAnchor(PlacePickerAnchor.Photo)
            advanceUntilIdle()
            assertFalse(vm.searchOnly.value)
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = LOCALITY),
                vm.state.value,
            )
        }

    @Test fun staleNoFixCurrentLoadDoesNotEnterSearchOnlyAfterSwitchBack() =
        runTest {
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = null))
            // No fix, and the GPS attempt takes seconds (virtual).
            val vm = viewModel(coordinate = null, fixDelayMillis = 3_000)
            vm.setMediaLocation(MEDIA)
            vm.load()
            advanceUntilIdle()

            // "Near me" starts resolving a fix; the user switches back to
            // the photo anchor before the no-fix result lands.
            vm.selectAnchor(PlacePickerAnchor.Current)
            runCurrent() // the Current load suspends inside the GPS delay
            vm.selectAnchor(PlacePickerAnchor.Photo)
            advanceUntilIdle() // photo load completes; the stale load must bail

            // The stale no-fix completion must NOT flip the photo-anchored
            // sheet into search-only mode (spec: no-fix + media anchor
            // stays functional).
            assertEquals(PlacePickerAnchor.Photo, vm.anchor.value)
            assertFalse(vm.searchOnly.value)
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = null),
                vm.state.value,
            )
        }

    @Test fun staleDeviceNearbyResponseDoesNotClobberPhotoAnchorState() =
        runTest {
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = null))
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } coAnswers {
                kotlinx.coroutines.delay(2_000)
                NetworkResult.Success(GeoNearbyPlacesResponse(places = emptyList(), locality = LOCALITY))
            }
            val vm = viewModel()
            vm.setMediaLocation(MEDIA)
            vm.load()
            advanceUntilIdle()

            vm.selectAnchor(PlacePickerAnchor.Current)
            runCurrent() // fix resolves instantly; the device nearby fetch is in flight
            vm.selectAnchor(PlacePickerAnchor.Photo)
            advanceUntilIdle() // stale device payload lands and must bail

            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = null),
                vm.state.value,
            )
            // The cache must hold the PHOTO payload — a short query restores it.
            vm.onQueryChange("c")
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = null),
                vm.state.value,
            )
        }

    @Test fun failedAnchorSwitchLoadDropsStaleNearbyCacheMidSearch() =
        runTest {
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = null))
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            coEvery { repo.geoSearchPlaces("coffee", any(), any()) } returns
                NetworkResult.Success(GeoPlaceSearchResponse(places = listOf(POI)))
            val vm = viewModel()
            vm.setMediaLocation(MEDIA)
            vm.load()
            advanceUntilIdle()
            vm.onQueryChange("coffee")
            advanceUntilIdle()

            // The device-anchored reload fails behind the live search: the
            // results stay, and the OLD anchor's payload must not be
            // restorable under the "Near me" chip.
            vm.selectAnchor(PlacePickerAnchor.Current)
            advanceUntilIdle()
            assertEquals(PlacePickerUiState.SearchResults(listOf(POI)), vm.state.value)
            vm.onQueryChange("")
            advanceUntilIdle()
            assertTrue(vm.state.value !is PlacePickerUiState.Loaded)
        }

    @Test fun setMediaLocationDropsStaleNearbyCacheAcrossPresentations() =
        runTest {
            // First presentation: device-anchored payload gets cached.
            coEvery { repo.geoNearbyPlaces(FIX.latitude, FIX.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = listOf(POI), locality = LOCALITY))
            val vm = viewModel(coordinate = FIX, fixDelayMillis = 3_000)
            vm.load()
            advanceUntilIdle()
            assertEquals(
                PlacePickerUiState.Loaded(nearby = listOf(POI), locality = LOCALITY),
                vm.state.value,
            )

            // Second presentation, now photo-anchored; its (slow) reload
            // is still in flight when a short query lands — the stale
            // device-anchored payload must NOT be restored.
            coEvery { repo.geoNearbyPlaces(MEDIA.latitude, MEDIA.longitude) } returns
                NetworkResult.Success(GeoNearbyPlacesResponse(places = emptyList(), locality = null))
            vm.setMediaLocation(MEDIA)
            vm.load()
            vm.onQueryChange("c")
            assertEquals(PlacePickerUiState.Loading, vm.state.value)
            advanceUntilIdle()
            assertEquals(
                PlacePickerUiState.Loaded(nearby = emptyList(), locality = null),
                vm.state.value,
            )
        }

    // MARK: - Tag mapping

    @Test fun postPlaceTagMapsPlaceFields() {
        val tag = PostPlaceTag(POI)
        assertEquals("Blue Bottle", tag.name)
        assertEquals("123 Main St", tag.address)
        assertEquals(45.52, tag.latitude, 0.0)
        assertEquals(-122.68, tag.longitude, 0.0)
        assertEquals("poi.123", tag.placeId)
        assertEquals("poi", tag.kind)
    }

    @Test fun postPlaceTagFallsBackToFullAddress() {
        val tag = PostPlaceTag(LOCALITY)
        assertEquals("Portland, Oregon, United States", tag.address)
        assertEquals("place", tag.kind)
    }

    private class FakeLocationProvider(
        private val coordinate: UserCoordinate?,
        private val delayMillis: Long = 0,
    ) : LocationProvider {
        override fun cachedCoordinate(): UserCoordinate? = coordinate

        override suspend fun requestCurrent(timeoutMillis: Long): UserCoordinate? {
            if (delayMillis > 0) kotlinx.coroutines.delay(delayMillis)
            return coordinate
        }
    }

    private companion object {
        val FIX = UserCoordinate(latitude = 45.52, longitude = -122.68, accuracyMeters = 20.0)

        /** Where the attached photo was taken — Chicago vs. the Portland fix. */
        val MEDIA = MediaCaptureLocation(latitude = 41.8781, longitude = -87.6298)
        val POI =
            GeoPlace(
                placeId = "poi.123",
                name = "Blue Bottle",
                category = "coffee shop, cafe",
                address = "123 Main St",
                fullAddress = "123 Main St, Portland, Oregon",
                center = GeoPlaceCenter(lat = 45.52, lng = -122.68),
                kind = "poi",
                distanceM = 120.0,
            )
        val LOCALITY =
            GeoPlace(
                placeId = "place.456",
                name = "Portland",
                category = null,
                address = null,
                fullAddress = "Portland, Oregon, United States",
                center = GeoPlaceCenter(lat = 45.515, lng = -122.679),
                kind = "place",
                distanceM = null,
            )
    }
}
