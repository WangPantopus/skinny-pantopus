@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.gigs

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigsListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors the iOS `GigSearchViewModelTests`: idle by default, debounced
 * loading, loaded/empty/error transitions, the category chip re-issues
 * the query, and the row projection matches the feed's.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigSearchViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: GigsRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun shelfGig(): GigDto =
        GigDto(
            id = "g1",
            title = "Hang 3 floating shelves",
            description = "Need 3 IKEA Lack shelves mounted on drywall.",
            price = 60.0,
            category = "handyman",
            status = "open",
            createdAt = "2026-05-14T08:00:00Z",
            userId = "u1",
            bidCount = 4,
            distanceMiles = 0.2,
        )

    private fun dogGig(): GigDto =
        GigDto(
            id = "g2",
            title = "Midday dog walks",
            description = "20-min loop, friendly shepherd mix.",
            price = 22.0,
            category = "petcare",
            status = "open",
            createdAt = "2026-05-14T05:00:00Z",
            userId = "u2",
            payType = "per_walk",
            bidCount = 0,
            distanceMiles = 0.5,
        )

    @Test fun starts_idle() =
        runTest(dispatcher) {
            val vm = GigSearchViewModel(repo)
            assertTrue(vm.state.value is GigSearchUiState.Idle)
        }

    @Test fun blank_query_stays_idle() =
        runTest(dispatcher) {
            val vm = GigSearchViewModel(repo)
            vm.onQueryChange("   ")
            advanceUntilIdle()
            assertTrue(vm.state.value is GigSearchUiState.Idle)
        }

    @Test fun query_enters_loading_then_loaded_reusing_feed_projection() =
        runTest(dispatcher) {
            coEvery {
                repo.list(
                    category = null,
                    sort = null,
                    latitude = null,
                    longitude = null,
                    radiusMiles = null,
                    limit = 20,
                    offset = 0,
                    search = "shel",
                )
            } returns NetworkResult.Success(GigsListResponse(listOf(shelfGig(), dogGig()), 2))
            val vm = GigSearchViewModel(repo)
            vm.onQueryChange("shel")
            // Loading flips synchronously, before the 250ms debounce fires.
            assertTrue(vm.state.value is GigSearchUiState.Loading)
            advanceUntilIdle()
            val loaded = vm.state.value as GigSearchUiState.Loaded
            assertEquals(2, loaded.rows.size)
            assertEquals(GigsCategory.Handyman, loaded.rows[0].category)
            assertEquals("$60", loaded.rows[0].price)
            // pay_type → "/ walk" suffix proves the shared feed projection ran.
            assertEquals("$22 / walk", loaded.rows[1].price)
        }

    @Test fun query_with_no_matches_transitions_empty() =
        runTest(dispatcher) {
            coEvery {
                repo.list(
                    category = null,
                    sort = null,
                    latitude = null,
                    longitude = null,
                    radiusMiles = null,
                    limit = 20,
                    offset = 0,
                    search = "zzzz",
                )
            } returns NetworkResult.Success(GigsListResponse(emptyList(), 0))
            val vm = GigSearchViewModel(repo)
            vm.onQueryChange("zzzz")
            advanceUntilIdle()
            assertTrue(vm.state.value is GigSearchUiState.Empty)
        }

    @Test fun query_failure_transitions_error() =
        runTest(dispatcher) {
            coEvery {
                repo.list(
                    category = null,
                    sort = null,
                    latitude = null,
                    longitude = null,
                    radiusMiles = null,
                    limit = 20,
                    offset = 0,
                    search = "shel",
                )
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = GigSearchViewModel(repo)
            vm.onQueryChange("shel")
            advanceUntilIdle()
            assertTrue(vm.state.value is GigSearchUiState.Error)
        }

    @Test fun select_category_refetches_with_filter() =
        runTest(dispatcher) {
            coEvery {
                repo.list(
                    category = null,
                    sort = null,
                    latitude = null,
                    longitude = null,
                    radiusMiles = null,
                    limit = 20,
                    offset = 0,
                    search = "walk",
                )
            } returns NetworkResult.Success(GigsListResponse(listOf(shelfGig(), dogGig()), 2))
            coEvery {
                repo.list(
                    category = "petcare",
                    sort = null,
                    latitude = null,
                    longitude = null,
                    radiusMiles = null,
                    limit = 20,
                    offset = 0,
                    search = "walk",
                )
            } returns NetworkResult.Success(GigsListResponse(listOf(dogGig()), 1))
            val vm = GigSearchViewModel(repo)
            vm.onQueryChange("walk")
            advanceUntilIdle()
            vm.selectCategory(GigsCategory.PetCare)
            advanceUntilIdle()
            assertEquals(GigsCategory.PetCare, vm.activeCategory.value)
            val loaded = vm.state.value as GigSearchUiState.Loaded
            assertEquals(1, loaded.rows.size)
            assertEquals(GigsCategory.PetCare, loaded.rows.first().category)
        }

    @Test fun select_category_without_query_does_not_fetch() =
        runTest(dispatcher) {
            val vm = GigSearchViewModel(repo)
            vm.selectCategory(GigsCategory.PetCare)
            advanceUntilIdle()
            assertEquals(GigsCategory.PetCare, vm.activeCategory.value)
            assertTrue(vm.state.value is GigSearchUiState.Idle)
        }
}
