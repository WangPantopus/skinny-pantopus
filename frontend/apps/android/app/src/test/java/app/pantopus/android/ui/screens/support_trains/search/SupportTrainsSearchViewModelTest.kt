@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.search

import app.pantopus.android.data.api.models.support_trains.SupportTrainListItemDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P4.6 — Support Trains search VM. Mirrors iOS
 * `SupportTrainsSearchViewModelTests`: drives the `/me/support-trains`
 * corpus through a mocked repository and asserts the client-side filter,
 * row mapping, and the open-train callback.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SupportTrainsSearchViewModelTest {
    private val repo: SupportTrainsRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun train(
        id: String,
        title: String,
        status: String,
    ) = SupportTrainListItemDto(
        id = id,
        title = title,
        status = status,
        myRole = "organizer",
    )

    private fun corpus() =
        listOf(
            train(
                "st1",
                "For the Chen family",
                "filling",
            ).copy(
                supportTrainType = "meal_support",
                recipientName = "For the Chen family",
                slotsFilled = 12,
                slotsTotal = 18,
            ),
            train(
                "st2",
                "For Daniel R.",
                "active",
            ).copy(
                supportTrainType = "ride_support",
                recipientName = "For Daniel R.",
                slotsFilled = 6,
                slotsTotal = 14,
            ),
            train(
                "st3",
                "For Mrs. Alvarez",
                "wrapping",
            ).copy(
                myRole = "helper",
                supportTrainType = "pet_care",
                recipientName = "For Mrs. Alvarez",
            ),
        )

    private fun loadedVm(rows: List<SupportTrainListItemDto> = corpus()): SupportTrainsSearchViewModel {
        coEvery { repo.mine(any(), any(), any(), any()) } returns
            NetworkResult.Success(SupportTrainsListResponse(supportTrains = rows))
        return SupportTrainsSearchViewModel(repo).also { it.load() }
    }

    @Test
    fun empty_query_yields_no_results() =
        runTest {
            val vm = loadedVm()
            assertTrue(vm.query.value.isEmpty())
            assertTrue(vm.results.value.isEmpty())
            assertFalse(vm.isLoading.value)
        }

    @Test
    fun query_filters_by_recipient_and_title() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("chen")
            assertEquals(listOf("st1"), vm.results.value.map { it.id })
            vm.setQuery("alvarez")
            assertEquals(listOf("st3"), vm.results.value.map { it.id })
        }

    @Test
    fun query_filters_by_train_type_label() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("ride")
            assertEquals(listOf("st2"), vm.results.value.map { it.id })
        }

    @Test
    fun query_is_case_insensitive_and_trimmed() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("  CHEN  ")
            assertEquals(listOf("st1"), vm.results.value.map { it.id })
        }

    @Test
    fun no_matches_yields_empty() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("zzzzzz")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test
    fun load_failure_degrades_to_empty_corpus() =
        runTest {
            coEvery { repo.mine(any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = SupportTrainsSearchViewModel(repo)
            vm.load()
            vm.setQuery("chen")
            assertTrue(vm.results.value.isEmpty())
            assertFalse(vm.isLoading.value)
        }

    @Test
    fun row_mapping_mirrors_list_template() =
        runTest {
            val vm = loadedVm()
            vm.setQuery("chen")
            val row = vm.rowFor(vm.results.value.first())
            assertEquals("For the Chen family", row.title)
            assertEquals("Meal train · You organize", row.subtitle)
            assertEquals("12 / 18 slots · 6 open", row.metaTail)
            assertTrue(row.leading is RowLeading.CategoryGradientIcon)
            assertTrue(row.trailing is RowTrailing.Status)
            assertEquals("Filling up", (row.trailing as RowTrailing.Status).text)
        }

    @Test
    fun row_tap_fires_open_train_callback() =
        runTest {
            val vm = loadedVm()
            var captured: String? = null
            vm.onOpenTrain = { captured = it }
            vm.setQuery("daniel")
            vm.rowFor(vm.results.value.first()).onTap()
            assertEquals("st2", captured)
        }
}
