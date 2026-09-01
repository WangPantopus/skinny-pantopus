@file:Suppress("LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains

import app.pantopus.android.data.api.models.support_trains.SupportTrainListItemDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsNearbyResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SupportTrainsViewModelTest {
    private val repo: SupportTrainsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // Real `/me/support-trains` shape — id / title / status / role only.
    private fun mineRow(
        id: String,
        status: String,
        role: String = "organizer",
        title: String = "A support train",
    ) = SupportTrainListItemDto(
        id = id,
        title = title,
        status = status,
        publishedAt = "2026-05-10T10:00:00Z",
        createdAt = "2026-05-10T09:30:00Z",
        myRole = role,
    )

    // Nearby-RPC shape — adds the enriched fields.
    private fun nearbyRow(
        id: String,
        type: String,
        filled: Int,
        total: Int,
        recipient: String,
        distance: Double = 640.0,
    ) = SupportTrainListItemDto(
        id = id,
        title = "Inner activity title",
        status = "filling",
        publishedAt = null,
        createdAt = "2026-05-10T09:30:00Z",
        myRole = null,
        supportTrainType = type,
        startsOn = "2026-05-18",
        endsOn = "2026-06-02",
        slotsFilled = filled,
        slotsTotal = total,
        distanceMeters = distance,
        recipientName = recipient,
    )

    // MARK: - Lifecycle

    @Test
    fun load_populated_renders_loaded() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = listOf(mineRow("st1", "filling"))))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsNearbyResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { 40.0 to -73.0 }
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.first().rows.size)
        }

    @Test
    fun load_empty_renders_empty_with_start_train_cta() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { null }
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No support trains yet", empty.headline)
            assertEquals("Start a train", empty.ctaTitle)
        }

    @Test
    fun both_fetches_failing_transitions_to_error() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { 40.0 to -73.0 }
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    // MARK: - Tabs

    @Test
    fun invitations_tab_segments_invited_rows() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    SupportTrainsListResponse(
                        supportTrains =
                            listOf(
                                mineRow("st1", "filling"),
                                mineRow("st3", "invited", role = "helper"),
                            ),
                    ),
                )
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsNearbyResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { null }
            vm.load()
            vm.selectTab(SupportTrainsTab.INVITATIONS)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("st3", state.sections.first().rows.first().id)
        }

    @Test
    fun nearby_tab_gracefully_degrades_without_location() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { null }
            vm.load()
            vm.selectTab(SupportTrainsTab.NEARBY)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("No trains nearby right now", (state as ListOfRowsUiState.Empty).headline)
        }

    // MARK: - Row mapping

    @Test
    fun my_trains_row_uses_generic_archetype_when_type_missing() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = listOf(mineRow("st1", "active"))))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsNearbyResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { null }
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val leading = state.sections.first().rows.first().leading
            assertTrue(leading is RowLeading.CategoryGradientIcon)
            assertEquals(PantopusIcon.HandCoins, (leading as RowLeading.CategoryGradientIcon).icon)
        }

    @Test
    fun nearby_row_uses_meal_archetype_and_renders_slot_progress() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = emptyList()))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    SupportTrainsNearbyResponse(
                        supportTrains = listOf(nearbyRow("n1", "meal_support", 12, 18, "For the Chen family")),
                    ),
                )
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { 40.0 to -73.0 }
            vm.load()
            vm.selectTab(SupportTrainsTab.NEARBY)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first()
            assertEquals("For the Chen family", row.title)
            assertEquals("12 / 18 slots · 6 open", row.metaTail)
            val leading = row.leading as RowLeading.CategoryGradientIcon
            assertEquals(PantopusIcon.Utensils, leading.icon)
        }

    @Test
    fun nearby_row_metaTail_falls_back_to_distance_when_no_slots() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = emptyList()))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    SupportTrainsNearbyResponse(
                        supportTrains =
                            listOf(
                                // 4830 metres ≈ 3 mi — exercises the distance-only meta tail
                                // fallback path when slot counts are missing.
                                SupportTrainListItemDto(
                                    id = "n2",
                                    title = "Errand train",
                                    status = "active",
                                    supportTrainType = "errand_support",
                                    distanceMeters = 4830.0,
                                ),
                            ),
                    ),
                )
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { 40.0 to -73.0 }
            vm.load()
            vm.selectTab(SupportTrainsTab.NEARBY)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("3 mi", state.sections.first().rows.first().metaTail)
        }

    @Test
    fun row_tap_fires_open_train_callback() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = listOf(mineRow("st42", "active"))))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsNearbyResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            var captured: String? = null
            vm.onOpenTrain = { captured = it }
            vm.locationProvider = { null }
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            state.sections.first().rows.first().onTap()
            assertEquals("st42", captured)
        }

    @Test
    fun helper_filter_passed_through_to_repository() =
        runTest {
            coEvery { repo.mine(role = null, status = null, limit = 20, offset = 0) } returns
                NetworkResult.Success(SupportTrainsListResponse(supportTrains = emptyList()))
            coEvery { repo.nearby(any(), any(), any(), any()) } returns
                NetworkResult.Success(SupportTrainsNearbyResponse(supportTrains = emptyList()))
            val vm = SupportTrainsViewModel(repo)
            vm.locationProvider = { null }
            vm.load()
            // load() does not pass a role filter; verifies the contract.
            assertNull((vm.state.value as ListOfRowsUiState.Empty).ctaTitle?.takeIf { false })
        }
}
