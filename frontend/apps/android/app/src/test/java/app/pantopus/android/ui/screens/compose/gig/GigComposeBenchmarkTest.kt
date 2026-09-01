@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.compose.gig

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.ai.AiTranscriptionRepository
import app.pantopus.android.data.api.models.gigs.PriceBenchmarkDto
import app.pantopus.android.data.api.models.gigs.PriceBenchmarkResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * P1.G — price-benchmark hint in the composer budget step: fetch on
 * entry with a category, silent hide on failure / zero comparables, and
 * the per-category dedupe guard.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigComposeBenchmarkTest {
    private val repo: GigsRepository = mockk(relaxed = true)
    private val filesRepo: FilesRepository = mockk(relaxed = true)
    private val transcriptionRepo: AiTranscriptionRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm() =
        GigComposeViewModel(
            repo,
            SavedStateHandle(),
            networkMonitor,
            filesRepo,
            transcriptionRepo,
            mockk(relaxed = true),
            mockk(relaxed = true),
        )

    private fun benchmark(
        comparableCount: Int = 12,
        low: Double? = 40.0,
        median: Double? = 75.0,
        high: Double? = 120.0,
    ) = PriceBenchmarkDto(
        low = low,
        median = median,
        high = high,
        basis = "completed_tasks",
        comparableCount = comparableCount,
        category = "handyman",
    )

    @Test
    fun fetch_with_category_populates_hint() =
        runTest {
            coEvery { repo.priceBenchmark("handyman") } returns
                NetworkResult.Success(PriceBenchmarkResponse(benchmark()))
            val vm = makeVm()
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.fetchPriceBenchmark()
            val hint = vm.state.value.priceBenchmark
            assertEquals(
                "Similar handyman tasks nearby: \$40–\$120 · median \$75",
                hint?.hintText,
            )
            assertEquals("completed tasks", hint?.basis)
        }

    @Test
    fun fetch_without_category_is_a_noop() =
        runTest {
            val vm = makeVm()
            vm.fetchPriceBenchmark()
            assertNull(vm.state.value.priceBenchmark)
            coVerify(exactly = 0) { repo.priceBenchmark(any()) }
        }

    @Test
    fun zero_comparables_hides_the_hint() =
        runTest {
            coEvery { repo.priceBenchmark("handyman") } returns
                NetworkResult.Success(PriceBenchmarkResponse(benchmark(comparableCount = 0)))
            val vm = makeVm()
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.fetchPriceBenchmark()
            assertNull(vm.state.value.priceBenchmark)
        }

    @Test
    fun missing_percentiles_hide_the_hint() =
        runTest {
            coEvery { repo.priceBenchmark("handyman") } returns
                NetworkResult.Success(PriceBenchmarkResponse(benchmark(median = null)))
            val vm = makeVm()
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.fetchPriceBenchmark()
            assertNull(vm.state.value.priceBenchmark)
        }

    @Test
    fun fetch_failure_is_silent() =
        runTest {
            coEvery { repo.priceBenchmark("handyman") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.fetchPriceBenchmark()
            assertNull(vm.state.value.priceBenchmark)
            assertNull("Benchmark failures never surface an error banner", vm.state.value.errorMessage)
        }

    @Test
    fun refetch_is_deduped_per_category() =
        runTest {
            coEvery { repo.priceBenchmark("handyman") } returns
                NetworkResult.Success(PriceBenchmarkResponse(benchmark()))
            coEvery { repo.priceBenchmark("cleaning") } returns
                NetworkResult.Success(PriceBenchmarkResponse(benchmark()))
            val vm = makeVm()
            vm.selectCategory(GigComposeCategory.Handyman)
            vm.fetchPriceBenchmark()
            vm.fetchPriceBenchmark()
            coVerify(exactly = 1) { repo.priceBenchmark("handyman") }
            // A category change re-arms the fetch.
            vm.selectCategory(GigComposeCategory.Cleaning)
            vm.fetchPriceBenchmark()
            coVerify(exactly = 1) { repo.priceBenchmark("cleaning") }
        }

    @Test
    fun cents_render_with_two_decimals() {
        val hint =
            GigComposeViewModel.projectBenchmark(
                "Pet care",
                PriceBenchmarkDto(low = 22.5, median = 30.0, high = 47.25, basis = null, comparableCount = 3),
            )
        assertEquals("Similar pet care tasks nearby: \$22.50–\$47.25 · median \$30", hint?.hintText)
        assertNull(hint?.basis)
    }
}
