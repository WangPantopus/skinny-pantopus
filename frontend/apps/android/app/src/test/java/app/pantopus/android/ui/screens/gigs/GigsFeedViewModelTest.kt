@file:Suppress("MagicNumber", "PackageNaming", "LargeClass")

package app.pantopus.android.ui.screens.gigs

import app.pantopus.android.data.api.models.gigs.CreateGigSavedSearchBody
import app.pantopus.android.data.api.models.gigs.GigActionSuccessResponse
import app.pantopus.android.data.api.models.gigs.GigBrowseClusterDto
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigSavedSearchDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigSavedSearchDto
import app.pantopus.android.data.api.models.gigs.GigSavedSearchMutationResponse
import app.pantopus.android.data.api.models.gigs.GigSavedSearchesResponse
import app.pantopus.android.data.api.models.gigs.GigsBrowseResponse
import app.pantopus.android.data.api.models.gigs.GigsBrowseSectionsDto
import app.pantopus.android.data.api.models.gigs.GigsListResponse
import app.pantopus.android.data.api.models.gigs.MagicPostBody
import app.pantopus.android.data.api.models.gigs.MagicPostGigDto
import app.pantopus.android.data.api.models.gigs.MagicPostResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.gigs.GigDraftQueue
import app.pantopus.android.data.gigs.GigQueuedDraft
import app.pantopus.android.data.gigs.GigSavedSearchesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.gigs.GigsV2Repository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.widget.WidgetSnapshotData
import app.pantopus.android.data.widget.WidgetSnapshotStore
import app.pantopus.android.data.widget.WidgetTaskSnapshot
import app.pantopus.android.ui.screens.compose.gig.GigComposeBudgetType
import app.pantopus.android.ui.screens.compose.gig.GigComposeFormState
import app.pantopus.android.ui.screens.compose.gig.GigComposeLocationMode
import app.pantopus.android.ui.screens.compose.gig.GigComposeScheduleType
import app.pantopus.android.ui.screens.compose.gig.GigComposeViewModel
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors the iOS [GigsFeedViewModelTests]: load → loaded/empty/error,
 * chip + sort each drive a refetch, and projection maps category +
 * bid-count correctly. Phase 1 adds the radius-suggestion ladder (P1.B),
 * dismiss / hide-category with undo (P1.D), the realtime `gig:new`
 * counter (P1.E), and browse-mode entry/exit (P1.F).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigsFeedViewModelTest {
    /** P6c — in-memory [GigDraftQueue] standing in for the prefs store. */
    private class FakeGigDraftQueue : GigDraftQueue {
        private val _drafts = MutableStateFlow<List<GigQueuedDraft>>(emptyList())
        override val drafts: StateFlow<List<GigQueuedDraft>> = _drafts

        override fun enqueue(draft: GigQueuedDraft) {
            _drafts.value =
                (_drafts.value.filterNot { it.id == draft.id } + draft)
                    .takeLast(GigDraftQueue.MAX_DRAFTS)
        }

        override fun remove(id: String) {
            _drafts.value = _drafts.value.filterNot { it.id == id }
        }
    }

    /** P6c — records the last widget snapshot write. */
    private class FakeWidgetSnapshotStore : WidgetSnapshotStore {
        var written: List<WidgetTaskSnapshot>? = null

        override fun write(tasks: List<WidgetTaskSnapshot>) {
            written = tasks
        }

        override fun read(): WidgetSnapshotData? = null
    }

    private val repo: GigsRepository = mockk()
    private val socket: SocketManager = mockk()
    private val authRepo: AuthRepository = mockk()
    private val location: LocationProvider = mockk()
    private val savedSearchesRepo: GigSavedSearchesRepository = mockk()

    /**
     * Nearby Support Trains only fire in the All / Support Trains feed
     * scopes; the default Tasks scope never touches this repo.
     */
    private val gigsV2Repo: GigsV2Repository = mockk(relaxed = true)
    private val draftQueue = FakeGigDraftQueue()
    private val widgetSnapshots = FakeWidgetSnapshotStore()
    private val isOnline = MutableStateFlow(true)
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns isOnline
        }

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { socket.eventsOf(any()) } returns emptyFlow()
        every { authRepo.state } returns
            MutableStateFlow<AuthRepository.State>(
                AuthRepository.State.SignedIn(
                    user = UserDto(id = "me", email = "me@example.com", displayName = "Me", avatarUrl = null),
                ),
            )
        // No coordinate by default → the feed takes the flat-list path.
        every { location.cachedCoordinate() } returns null
        coEvery { location.requestCurrent(any()) } returns null
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm() =
        GigsFeedViewModel(
            repo,
            socket,
            authRepo,
            location,
            savedSearchesRepo,
            draftQueue,
            widgetSnapshots,
            networkMonitor,
            gigsV2Repo,
        )

    private fun handymanGig(
        id: String = "g1",
        bidCount: Int = 4,
    ): GigDto =
        GigDto(
            id = id,
            title = "Hang 3 floating shelves in living room",
            description = "Need 3 IKEA Lack shelves mounted on drywall.",
            price = 60.0,
            category = "handyman",
            status = "open",
            createdAt = "2026-05-14T08:00:00Z",
            userId = "u1",
            bidCount = bidCount,
            distanceMiles = 0.2,
        )

    private fun cleaningGig(id: String = "g2"): GigDto =
        GigDto(
            id = id,
            title = "Deep clean 2BR apartment",
            description = "Kitchen, bath, baseboards.",
            price = 180.0,
            category = "cleaning",
            status = "open",
            createdAt = "2026-05-14T05:00:00Z",
            userId = "u2",
            bidCount = 0,
            distanceMiles = 0.5,
        )

    private fun stubFlat(
        gigs: List<GigDto>,
        radiusMiles: Double = 1.0,
    ) {
        coEvery {
            repo.list(null, "newest", null, null, radiusMiles, 20, 0)
        } returns NetworkResult.Success(GigsListResponse(gigs, gigs.size))
    }

    @Test fun load_with_gigs_transitions_loaded() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(2, loaded.rows.size)
            assertEquals(GigsCategory.Handyman, loaded.rows[0].category)
            assertEquals(4, loaded.rows[0].bidCount)
            assertEquals("$60", loaded.rows[0].price)
            assertEquals(GigsCategory.Cleaning, loaded.rows[1].category)
            assertEquals(0, loaded.rows[1].bidCount)
        }

    @Test fun load_empty_transitions_empty_with_radius() =
        runTest {
            coEvery {
                repo.list(null, "newest", null, null, 2.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(emptyList(), 0))
            val vm = makeVm()
            vm.configureLocation(latitude = null, longitude = null, radiusMiles = 2.0)
            vm.load()
            val empty = vm.state.value as GigsFeedUiState.Empty
            assertEquals(2.0, empty.radiusMiles, 0.0)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery {
                repo.list(null, "newest", null, null, 1.0, 20, 0)
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is GigsFeedUiState.Error)
        }

    @Test fun select_category_refetches() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            coEvery {
                repo.list("cleaning", "newest", null, null, 1.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(listOf(cleaningGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.selectCategory(GigsCategory.Cleaning)
            assertEquals(GigsCategory.Cleaning, vm.activeCategory.value)
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(1, loaded.rows.size)
            assertEquals(GigsCategory.Cleaning, loaded.rows.first().category)
        }

    @Test fun select_sort_refetches() =
        runTest {
            stubFlat(listOf(handymanGig()))
            coEvery {
                repo.list(null, "highest_pay", null, null, 1.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(listOf(cleaningGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.selectSort(GigsSort.HighestPay)
            assertEquals(GigsSort.HighestPay, vm.activeSort.value)
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(GigsCategory.Cleaning, loaded.rows.first().category)
        }

    @Test fun apply_budget_filter_refetches_with_price_params() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            // P0.4 — budget pushes minPrice/maxPrice server-side on refetch.
            coEvery {
                repo.list(null, "newest", null, null, 1.0, 20, 0, maxPrice = 100.0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            val vm = makeVm()
            vm.load()
            // handyman is $60, cleaning is $180 → a $0–$100 budget keeps only the first.
            vm.applyFilters(GigFilterCriteria(budgetLower = 0f, budgetUpper = 100f))
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1"), loaded.rows.map { it.id })
            assertEquals(1, vm.activeFilterCount.value)
            coVerify(exactly = 1) {
                repo.list(null, "newest", null, null, 1.0, 20, 0, maxPrice = 100.0)
            }
        }

    @Test fun apply_filters_maps_every_server_expressible_dimension() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            val scheduledOpenGig = handymanGig().copy(scheduleType = "scheduled")
            coEvery {
                repo.list(
                    null,
                    "newest",
                    null,
                    null,
                    1.0,
                    20,
                    0,
                    minPrice = 50.0,
                    maxPrice = 100.0,
                    scheduleType = "scheduled",
                    payType = "offers",
                )
            } returns NetworkResult.Success(GigsListResponse(listOf(scheduledOpenGig), 1))
            val vm = makeVm()
            vm.load()
            vm.applyFilters(
                GigFilterCriteria(
                    budgetLower = 50f,
                    budgetUpper = 100f,
                    schedules = setOf(GigScheduleFilter.OneTime),
                    openToBids = true,
                ),
            )
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1"), loaded.rows.map { it.id })
            coVerify(exactly = 1) {
                repo.list(
                    null,
                    "newest",
                    null,
                    null,
                    1.0,
                    20,
                    0,
                    minPrice = 50.0,
                    maxPrice = 100.0,
                    scheduleType = "scheduled",
                    payType = "offers",
                )
            }
        }

    @Test fun multi_schedule_selection_stays_client_side() =
        runTest {
            // Two schedule buckets can't ride the single-value backend
            // param — the refetch carries no schedule_type and the
            // intersection happens client-side.
            stubFlat(
                listOf(
                    handymanGig().copy(scheduleType = "scheduled"),
                    cleaningGig().copy(scheduleType = "recurring"),
                ),
            )
            val vm = makeVm()
            vm.load()
            vm.applyFilters(
                GigFilterCriteria(schedules = setOf(GigScheduleFilter.OneTime, GigScheduleFilter.Flexible)),
            )
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1"), loaded.rows.map { it.id })
        }

    @Test fun apply_filter_with_no_matches_falls_to_empty() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            val vm = makeVm()
            vm.load()
            vm.applyFilters(GigFilterCriteria(categories = setOf(GigsCategory.Tech)))
            assertTrue(vm.state.value is GigsFeedUiState.Empty)
        }

    @Test fun resetting_filters_restores_full_list() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            val vm = makeVm()
            vm.load()
            vm.applyFilters(GigFilterCriteria(categories = setOf(GigsCategory.Tech)))
            vm.applyFilters(GigFilterCriteria())
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(2, loaded.rows.size)
            assertEquals(0, vm.activeFilterCount.value)
        }

    // MARK: - P1.A urgent projection

    @Test fun urgent_flag_projects_into_card() {
        val card = GigsFeedViewModel.projectCard(handymanGig().copy(isUrgent = true))
        assertTrue(card.isUrgent)
        assertFalse(GigsFeedViewModel.projectCard(handymanGig()).isUrgent)
    }

    // MARK: - P1.B radius suggestion

    @Test fun under_three_results_suggests_next_radius_step() =
        runTest {
            stubFlat(listOf(handymanGig()))
            val vm = makeVm()
            vm.load()
            val suggestion = vm.radiusSuggestion.value
            assertNotNull(suggestion)
            assertEquals(1, suggestion!!.visibleCount)
            assertEquals(1.0, suggestion.currentRadiusMiles, 0.0)
            assertEquals(3.0, suggestion.suggestedRadiusMiles, 0.0)
        }

    @Test fun three_or_more_results_suppress_suggestion() =
        runTest {
            stubFlat(listOf(handymanGig("g1"), handymanGig("g2"), cleaningGig("g3")))
            val vm = makeVm()
            vm.load()
            assertNull(vm.radiusSuggestion.value)
        }

    @Test fun accepting_suggestion_bumps_radius_and_refetches() =
        runTest {
            stubFlat(listOf(handymanGig()))
            stubFlat(listOf(handymanGig("g1"), handymanGig("g2"), cleaningGig("g3")), radiusMiles = 3.0)
            val vm = makeVm()
            vm.load()
            vm.acceptRadiusSuggestion()
            assertNull(vm.radiusSuggestion.value)
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(3, loaded.rows.size)
            coVerify(exactly = 1) { repo.list(null, "newest", null, null, 3.0, 20, 0) }
        }

    @Test fun suggestion_walks_the_ladder_and_stops_at_cap() =
        runTest {
            stubFlat(listOf(handymanGig()), radiusMiles = 5.0)
            stubFlat(listOf(handymanGig()), radiusMiles = 10.0)
            val vm = makeVm()
            vm.configureLocation(latitude = null, longitude = null, radiusMiles = 5.0)
            vm.load()
            assertEquals(10.0, vm.radiusSuggestion.value!!.suggestedRadiusMiles, 0.0)
            vm.acceptRadiusSuggestion()
            // 10 mi is the cap — no further suggestion even with one row.
            assertNull(vm.radiusSuggestion.value)
        }

    @Test fun dismissed_suggestion_stays_hidden_for_the_session() =
        runTest {
            stubFlat(listOf(handymanGig()))
            val vm = makeVm()
            vm.load()
            vm.dismissRadiusSuggestion()
            assertNull(vm.radiusSuggestion.value)
            vm.refresh()
            assertNull(vm.radiusSuggestion.value)
        }

    @Test fun active_filters_suppress_suggestion() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            coEvery {
                repo.list(null, "newest", null, null, 1.0, 20, 0, maxPrice = 100.0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.applyFilters(GigFilterCriteria(budgetLower = 0f, budgetUpper = 100f))
            assertNull(vm.radiusSuggestion.value)
        }

    // MARK: - P1.D dismiss / hide-category

    @Test fun dismiss_gig_drops_row_and_posts() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            coEvery { repo.dismissGig("g1") } returns NetworkResult.Success(GigActionSuccessResponse(true))
            val vm = makeVm()
            vm.load()
            vm.dismissGig("g1")
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g2"), loaded.rows.map { it.id })
            val toast = vm.toast.value
            assertNotNull(toast)
            assertEquals(GigsFeedUndo.Dismiss("g1"), toast!!.undo)
            coVerify(exactly = 1) { repo.dismissGig("g1") }
        }

    @Test fun undo_dismiss_reinserts_row_at_original_position() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            coEvery { repo.dismissGig("g1") } returns NetworkResult.Success(GigActionSuccessResponse(true))
            coEvery { repo.undoDismissGig("g1") } returns NetworkResult.Success(GigActionSuccessResponse(true))
            val vm = makeVm()
            vm.load()
            vm.dismissGig("g1")
            vm.undo(GigsFeedUndo.Dismiss("g1"))
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1", "g2"), loaded.rows.map { it.id })
            assertNull(vm.toast.value)
            coVerify(exactly = 1) { repo.undoDismissGig("g1") }
        }

    @Test fun failed_dismiss_restores_row_with_error_toast() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            coEvery { repo.dismissGig("g1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.dismissGig("g1")
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1", "g2"), loaded.rows.map { it.id })
            assertTrue(vm.toast.value!!.isError)
        }

    @Test fun hide_category_drops_every_row_of_it() =
        runTest {
            stubFlat(listOf(handymanGig("g1"), cleaningGig("g2"), handymanGig("g3")))
            coEvery { repo.hideCategory("handyman") } returns NetworkResult.Success(GigActionSuccessResponse(true))
            val vm = makeVm()
            vm.load()
            vm.hideCategory(GigsCategory.Handyman)
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g2"), loaded.rows.map { it.id })
            assertEquals(GigsFeedUndo.HideCategory(GigsCategory.Handyman), vm.toast.value!!.undo)
            coVerify(exactly = 1) { repo.hideCategory("handyman") }
        }

    @Test fun undo_hide_category_restores_rows_in_place() =
        runTest {
            stubFlat(listOf(handymanGig("g1"), cleaningGig("g2"), handymanGig("g3")))
            coEvery { repo.hideCategory("handyman") } returns NetworkResult.Success(GigActionSuccessResponse(true))
            coEvery { repo.unhideCategory("handyman") } returns NetworkResult.Success(GigActionSuccessResponse(true))
            val vm = makeVm()
            vm.load()
            vm.hideCategory(GigsCategory.Handyman)
            vm.undo(GigsFeedUndo.HideCategory(GigsCategory.Handyman))
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1", "g2", "g3"), loaded.rows.map { it.id })
            coVerify(exactly = 1) { repo.unhideCategory("handyman") }
        }

    @Test fun failed_hide_category_restores_rows_with_error_toast() =
        runTest {
            stubFlat(listOf(handymanGig("g1"), cleaningGig("g2")))
            coEvery { repo.hideCategory("handyman") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.hideCategory(GigsCategory.Handyman)
            val loaded = vm.state.value as GigsFeedUiState.Loaded
            assertEquals(listOf("g1", "g2"), loaded.rows.map { it.id })
            assertTrue(vm.toast.value!!.isError)
        }

    // MARK: - P1.E realtime new-task counter

    @Test fun gig_new_events_from_the_socket_accumulate() =
        runTest {
            val events = MutableSharedFlow<JSONObject>()
            every { socket.eventsOf("gig:new") } returns events
            stubFlat(listOf(handymanGig(), cleaningGig(), handymanGig("g3")))
            val vm = makeVm()
            vm.load()
            val payload = mockk<JSONObject> { every { optString("userId") } returns "stranger" }
            events.emit(payload)
            events.emit(payload)
            assertEquals(2, vm.newTaskCount.value)
        }

    @Test fun own_gig_new_events_are_ignored() {
        val vm = makeVm()
        vm.onGigNewEvent(posterId = "me")
        assertEquals(0, vm.newTaskCount.value)
        vm.onGigNewEvent(posterId = "someone-else")
        assertEquals(1, vm.newTaskCount.value)
        // Anonymous payloads still count — better to over-notify than miss.
        vm.onGigNewEvent(posterId = null)
        assertEquals(2, vm.newTaskCount.value)
    }

    @Test fun banner_tap_clears_count_and_refetches() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig(), handymanGig("g3")))
            val vm = makeVm()
            vm.load()
            vm.onGigNewEvent(posterId = "stranger")
            assertEquals(1, vm.newTaskCount.value)
            vm.refreshFromNewTasksBanner()
            assertEquals(0, vm.newTaskCount.value)
            coVerify(exactly = 2) { repo.list(null, "newest", null, null, 1.0, 20, 0) }
        }

    // MARK: - P1.F browse mode

    private fun browseResponse(): GigsBrowseResponse =
        GigsBrowseResponse(
            sections =
                GigsBrowseSectionsDto(
                    bestMatches = listOf(handymanGig("b1"), handymanGig("b2"), cleaningGig("b3"), cleaningGig("b4")),
                    urgent = listOf(handymanGig("u1").copy(isUrgent = true)),
                    clusters =
                        listOf(
                            GigBrowseClusterDto(category = "cleaning", count = 4),
                            // Zero-count and null-category clusters are dropped.
                            GigBrowseClusterDto(category = "tech", count = 0),
                            GigBrowseClusterDto(category = null, count = 3),
                        ),
                    highPaying = listOf(cleaningGig("h1")),
                    newToday = listOf(handymanGig("n1")),
                    quickJobs = emptyList(),
                ),
            totalActive = 27,
            radiusUsed = 160_934,
        )

    private fun stubBrowseLocation() {
        every { location.cachedCoordinate() } returns
            UserCoordinate(latitude = 40.7, longitude = -73.9, accuracyMeters = 50.0)
    }

    @Test fun load_with_location_and_no_scope_enters_browse() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Success(browseResponse())
            val vm = makeVm()
            vm.load()
            val browse = (vm.state.value as GigsFeedUiState.BrowseLoaded).browse
            // Vertical sections cap at three rows.
            assertEquals(listOf("b1", "b2", "b3"), browse.bestMatches.map { it.id })
            assertEquals(listOf("u1"), browse.urgent.map { it.id })
            assertEquals(listOf("n1"), browse.newToday.map { it.id })
            assertEquals(listOf("h1"), browse.highPaying.map { it.id })
            assertTrue(browse.quickJobs.isEmpty())
            assertEquals(listOf(GigsCategory.Cleaning), browse.clusters.map { it.category })
            assertEquals(27, browse.totalActive)
        }

    @Test fun selecting_a_category_exits_browse_and_all_re_enters() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Success(browseResponse())
            coEvery {
                repo.list("cleaning", "newest", 40.7, -73.9, 1.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(listOf(cleaningGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.selectCategory(GigsCategory.Cleaning)
            assertTrue(vm.state.value is GigsFeedUiState.Loaded)
            vm.selectCategory(GigsCategory.All)
            assertTrue(vm.state.value is GigsFeedUiState.BrowseLoaded)
            coVerify(exactly = 2) { repo.browse(40.7, -73.9) }
        }

    @Test fun see_all_exits_browse_with_matching_sort() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Success(browseResponse())
            coEvery {
                repo.list(null, "highest_pay", 40.7, -73.9, 1.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(listOf(cleaningGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.exitBrowse(GigsSort.HighestPay)
            assertEquals(GigsSort.HighestPay, vm.activeSort.value)
            assertTrue(vm.state.value is GigsFeedUiState.Loaded)
            // Browse stays exited on refresh until "All" is re-tapped.
            vm.refresh()
            assertTrue(vm.state.value is GigsFeedUiState.Loaded)
        }

    @Test fun sort_change_exits_browse() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Success(browseResponse())
            coEvery {
                repo.list(null, "urgency", 40.7, -73.9, 1.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.selectSort(GigsSort.Urgency)
            assertTrue(vm.state.value is GigsFeedUiState.Loaded)
        }

    @Test fun structured_filters_exit_browse() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Success(browseResponse())
            coEvery {
                repo.list(null, "newest", 40.7, -73.9, 1.0, 20, 0, maxPrice = 100.0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            val vm = makeVm()
            vm.load()
            vm.applyFilters(GigFilterCriteria(budgetLower = 0f, budgetUpper = 100f))
            assertTrue(vm.state.value is GigsFeedUiState.Loaded)
        }

    @Test fun empty_browse_sections_fall_to_empty_state() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns
                NetworkResult.Success(GigsBrowseResponse(sections = GigsBrowseSectionsDto(), totalActive = 0))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is GigsFeedUiState.Empty)
        }

    @Test fun browse_failure_transitions_error() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is GigsFeedUiState.Error)
        }

    // MARK: - P6a saved searches + alerts

    private fun savedSearch(
        id: String = "s1",
        name: String? = null,
        notify: Boolean = true,
    ): GigSavedSearchDto =
        GigSavedSearchDto(
            id = id,
            userId = "me",
            name = name,
            category = "cleaning",
            maxPrice = 100.0,
            latitude = 40.7,
            longitude = -73.9,
            radiusMiles = 5.0,
            notify = notify,
            createdAt = "2026-05-14T08:00:00Z",
        )

    @Test fun save_search_posts_live_state_and_toasts() =
        runTest {
            // The save applies the sheet's working criteria → flat refetch.
            coEvery {
                repo.list(null, "newest", 40.7, -73.9, 1.0, 20, 0, maxPrice = 100.0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            val body = slot<CreateGigSavedSearchBody>()
            coEvery { savedSearchesRepo.create(capture(body)) } returns
                NetworkResult.Success(GigSavedSearchMutationResponse(search = savedSearch()))
            val vm = makeVm()
            vm.configureLocation(latitude = 40.7, longitude = -73.9)
            vm.saveSearch(GigFilterCriteria(budgetUpper = 100f))
            assertEquals("Search saved — we'll alert you", vm.toast.value!!.text)
            assertEquals("under $100 · 1 mi", body.captured.name)
            assertNull(body.captured.category)
            assertNull(body.captured.minPrice)
            assertEquals(100.0, body.captured.maxPrice!!, 0.0)
            assertNull(body.captured.scheduleType)
            assertNull(body.captured.payType)
            assertEquals(40.7, body.captured.latitude, 0.0)
            assertEquals(-73.9, body.captured.longitude, 0.0)
            assertEquals(1.0, body.captured.radiusMiles, 0.0)
            assertTrue(body.captured.notify)
        }

    @Test fun save_search_carries_the_active_category_chip() =
        runTest {
            coEvery {
                repo.list("cleaning", "newest", 40.7, -73.9, 1.0, 20, 0)
            } returns NetworkResult.Success(GigsListResponse(listOf(cleaningGig()), 1))
            val body = slot<CreateGigSavedSearchBody>()
            coEvery { savedSearchesRepo.create(capture(body)) } returns
                NetworkResult.Success(GigSavedSearchMutationResponse(search = savedSearch()))
            val vm = makeVm()
            vm.configureLocation(latitude = 40.7, longitude = -73.9)
            vm.selectCategory(GigsCategory.Cleaning)
            vm.saveSearch(GigFilterCriteria())
            assertEquals("cleaning", body.captured.category)
            assertEquals("Cleaning · 1 mi", body.captured.name)
        }

    @Test fun deduped_save_flips_the_toast_copy() =
        runTest {
            coEvery {
                repo.list(null, "newest", 40.7, -73.9, 1.0, 20, 0, maxPrice = 100.0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            coEvery { savedSearchesRepo.create(any()) } returns
                NetworkResult.Success(GigSavedSearchMutationResponse(search = savedSearch(), deduped = true))
            val vm = makeVm()
            vm.configureLocation(latitude = 40.7, longitude = -73.9)
            vm.saveSearch(GigFilterCriteria(budgetUpper = 100f))
            assertEquals("Already saved — alerts re-enabled", vm.toast.value!!.text)
        }

    @Test fun save_search_without_location_errors_without_posting() =
        runTest {
            val vm = makeVm()
            vm.saveSearch(GigFilterCriteria())
            assertTrue(vm.toast.value!!.isError)
            coVerify(exactly = 0) { savedSearchesRepo.create(any()) }
        }

    @Test fun failed_save_surfaces_error_toast() =
        runTest {
            coEvery {
                repo.list(null, "newest", 40.7, -73.9, 1.0, 20, 0, maxPrice = 100.0)
            } returns NetworkResult.Success(GigsListResponse(listOf(handymanGig()), 1))
            coEvery { savedSearchesRepo.create(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.configureLocation(latitude = 40.7, longitude = -73.9)
            vm.saveSearch(GigFilterCriteria(budgetUpper = 100f))
            assertTrue(vm.toast.value!!.isError)
        }

    @Test fun load_saved_searches_projects_rows() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns
                NetworkResult.Success(GigSavedSearchesResponse(listOf(savedSearch())))
            val vm = makeVm()
            vm.loadSavedSearches()
            val loaded = vm.savedSearches.value as GigSavedSearchesUiState.Loaded
            val row = loaded.rows.single()
            assertEquals("s1", row.id)
            // No stored name → the derived label is the title; the summary
            // is suppressed because it would just repeat it.
            assertEquals("Cleaning · under $100 · 5 mi", row.title)
            assertNull(row.summary)
            assertNotNull(row.savedAgo)
            assertTrue(row.notify)
        }

    @Test fun custom_name_keeps_the_derived_summary() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns
                NetworkResult.Success(GigSavedSearchesResponse(listOf(savedSearch(name = "My cleaning alerts"))))
            val vm = makeVm()
            vm.loadSavedSearches()
            val row = (vm.savedSearches.value as GigSavedSearchesUiState.Loaded).rows.single()
            assertEquals("My cleaning alerts", row.title)
            assertEquals("Cleaning · under $100 · 5 mi", row.summary)
        }

    @Test fun empty_saved_searches_fall_to_empty_state() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns NetworkResult.Success(GigSavedSearchesResponse(emptyList()))
            val vm = makeVm()
            vm.loadSavedSearches()
            assertTrue(vm.savedSearches.value is GigSavedSearchesUiState.Empty)
        }

    @Test fun saved_searches_failure_transitions_error() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.loadSavedSearches()
            assertTrue(vm.savedSearches.value is GigSavedSearchesUiState.Error)
        }

    @Test fun notify_toggle_is_optimistic_and_patches() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns
                NetworkResult.Success(GigSavedSearchesResponse(listOf(savedSearch())))
            coEvery { savedSearchesRepo.update("s1", notify = false) } returns
                NetworkResult.Success(GigSavedSearchMutationResponse(search = savedSearch(notify = false)))
            val vm = makeVm()
            vm.loadSavedSearches()
            vm.setSavedSearchNotify("s1", false)
            val row = (vm.savedSearches.value as GigSavedSearchesUiState.Loaded).rows.single()
            assertFalse(row.notify)
            coVerify(exactly = 1) { savedSearchesRepo.update("s1", notify = false) }
        }

    @Test fun failed_notify_toggle_reverts_with_error_toast() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns
                NetworkResult.Success(GigSavedSearchesResponse(listOf(savedSearch())))
            coEvery { savedSearchesRepo.update("s1", notify = false) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.loadSavedSearches()
            vm.setSavedSearchNotify("s1", false)
            val row = (vm.savedSearches.value as GigSavedSearchesUiState.Loaded).rows.single()
            assertTrue(row.notify)
            assertTrue(vm.toast.value!!.isError)
        }

    @Test fun delete_is_optimistic_and_falls_to_empty() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns
                NetworkResult.Success(GigSavedSearchesResponse(listOf(savedSearch())))
            coEvery { savedSearchesRepo.delete("s1") } returns
                NetworkResult.Success(GigSavedSearchDeleteResponse(message = "Saved search deleted"))
            val vm = makeVm()
            vm.loadSavedSearches()
            vm.deleteSavedSearch("s1")
            assertTrue(vm.savedSearches.value is GigSavedSearchesUiState.Empty)
            coVerify(exactly = 1) { savedSearchesRepo.delete("s1") }
        }

    @Test fun failed_delete_restores_the_row_with_error_toast() =
        runTest {
            coEvery { savedSearchesRepo.list() } returns
                NetworkResult.Success(GigSavedSearchesResponse(listOf(savedSearch())))
            coEvery { savedSearchesRepo.delete("s1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.loadSavedSearches()
            vm.deleteSavedSearch("s1")
            val loaded = vm.savedSearches.value as GigSavedSearchesUiState.Loaded
            assertEquals(listOf("s1"), loaded.rows.map { it.id })
            assertTrue(vm.toast.value!!.isError)
        }

    // MARK: - P6c "Tasks near me" widget snapshot

    @Test fun flat_fetch_writes_widget_snapshot() =
        runTest {
            stubFlat(listOf(handymanGig(), cleaningGig()))
            makeVm().load()
            val written = widgetSnapshots.written
            assertNotNull("Every successful fetch refreshes the widget.", written)
            assertEquals(listOf("g1", "g2"), written!!.map { it.id })
            assertEquals("Hang 3 floating shelves in living room", written[0].title)
            assertEquals("$60", written[0].price)
            assertEquals("0.2mi", written[0].distance)
            assertEquals("handyman", written[0].categoryKey)
        }

    @Test fun browse_fetch_writes_flattened_deduped_widget_snapshot() =
        runTest {
            stubBrowseLocation()
            coEvery { repo.browse(40.7, -73.9) } returns NetworkResult.Success(browseResponse())
            makeVm().load()
            val written = widgetSnapshots.written
            assertNotNull(written)
            // bestMatches + newToday + urgent + highPaying (+ quickJobs), capped at 10.
            assertEquals(listOf("b1", "b2", "b3", "b4", "n1", "u1", "h1"), written!!.map { it.id })
            assertTrue(written.size <= WidgetSnapshotStore.MAX_TASKS)
        }

    @Test fun failed_fetch_leaves_widget_snapshot_untouched() =
        runTest {
            coEvery {
                repo.list(null, "newest", null, null, 1.0, 20, 0)
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            makeVm().load()
            assertNull(widgetSnapshots.written)
        }

    // MARK: - P6c offline draft queue banner

    private fun reviewReadyForm(): GigComposeFormState =
        GigComposeFormState(
            title = "Hang 3 shelves in the living room",
            description = "Need three IKEA Lack shelves mounted on drywall.",
            budgetType = GigComposeBudgetType.Fixed,
            budgetMin = "60",
            scheduleType = GigComposeScheduleType.Flexible,
            locationMode = GigComposeLocationMode.YourAddress,
        )

    private fun queuedDraft(id: String = "d1") =
        GigQueuedDraft(
            id = id,
            createdAtEpochMs = 0L,
            title = "Hang 3 shelves in the living room",
            form = GigComposeViewModel.formSnapshot(reviewReadyForm()),
        )

    @Test fun draft_banner_appears_when_online_with_pending_drafts() =
        runTest {
            draftQueue.enqueue(queuedDraft())
            val vm = makeVm()
            val banner = vm.draftBanner.value
            assertNotNull(banner)
            assertEquals(1, banner!!.count)
            assertEquals("Hang 3 shelves in the living room", banner.title)
        }

    @Test fun draft_banner_hidden_while_offline_and_returns_online() =
        runTest {
            isOnline.value = false
            draftQueue.enqueue(queuedDraft())
            val vm = makeVm()
            assertNull("Offline keeps the banner hidden.", vm.draftBanner.value)
            isOnline.value = true
            assertNotNull("Reconnecting surfaces the pending draft.", vm.draftBanner.value)
        }

    @Test fun post_pending_draft_success_removes_it_and_toasts() =
        runTest {
            stubFlat(listOf(handymanGig()))
            draftQueue.enqueue(queuedDraft())
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns
                NetworkResult.Success(
                    MagicPostResponse(
                        message = "Task posted",
                        gig = MagicPostGigDto(id = "gig_99", title = "Hang 3 shelves", undoWindowMs = 10_000, canUndo = true),
                        nearbyHelpers = 3,
                        notifiedCount = 2,
                    ),
                )
            val vm = makeVm()
            vm.postPendingDraft()
            assertTrue("Posted draft leaves the queue.", draftQueue.drafts.value.isEmpty())
            assertNull(vm.draftBanner.value)
            assertFalse(vm.toast.value!!.isError)
            // Same magic-post path the composer uses, with the snapshot's fields.
            coVerify(exactly = 1) {
                repo.magicPost(
                    match<MagicPostBody> { it.draft.title == "Hang 3 shelves in the living room" && it.beneficiaryUserId == null },
                )
            }
        }

    @Test fun post_pending_draft_failure_keeps_it_with_error_toast() =
        runTest {
            draftQueue.enqueue(queuedDraft())
            coEvery { repo.magicPost(any<MagicPostBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.postPendingDraft()
            assertEquals("Failed retry keeps the draft queued.", 1, draftQueue.drafts.value.size)
            assertTrue(vm.toast.value!!.isError)
        }

    @Test fun discard_pending_draft_removes_it() =
        runTest {
            draftQueue.enqueue(queuedDraft())
            val vm = makeVm()
            vm.discardPendingDraft()
            assertTrue(draftQueue.drafts.value.isEmpty())
            assertNull(vm.draftBanner.value)
        }
}
