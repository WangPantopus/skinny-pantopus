@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.setup

import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.CheckSlugResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
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

@OptIn(ExperimentalCoroutinesApi::class)
class FirstRunWizardViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = FirstRunWizardViewModel(repo, errors)

    @Test
    fun `slug check resolves to Available`() =
        runTest(dispatcher) {
            coEvery { repo.checkSlug(any(), any()) } returns NetworkResult.Success(CheckSlugResponse(available = true))
            val vm = vm()
            vm.onSlugChange("maria-k")
            advanceUntilIdle()
            assertEquals(SlugFieldUiState.Available, vm.state.value.slugState)
        }

    @Test
    fun `slug check resolves to Taken with suggestions`() =
        runTest(dispatcher) {
            coEvery { repo.checkSlug(any(), any()) } returns
                NetworkResult.Success(CheckSlugResponse(available = false, suggestions = listOf("maria-k2", "maria-kowalski")))
            val vm = vm()
            vm.onSlugChange("maria-k")
            advanceUntilIdle()
            val taken = vm.state.value.slugState as SlugFieldUiState.Taken
            assertEquals(listOf("maria-k2", "maria-kowalski"), taken.suggestions)
        }

    @Test
    fun `blank slug returns to Idle`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.onSlugChange("")
            advanceUntilIdle()
            assertEquals(SlugFieldUiState.Idle, vm.state.value.slugState)
        }

    @Test
    fun `claim slug advances from Link to Type`() =
        runTest(dispatcher) {
            coEvery { repo.checkSlug(any(), any()) } returns NetworkResult.Success(CheckSlugResponse(available = true))
            coEvery { repo.updateSlug(any(), any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", slug = "maria-k")))
            val vm = vm()
            vm.onSlugChange("maria-k")
            advanceUntilIdle()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(2, vm.state.value.step)
        }

    @Test
    fun `create starter type advances to Hours`() =
        runTest(dispatcher) {
            coEvery { repo.checkSlug(any(), any()) } returns NetworkResult.Success(CheckSlugResponse(available = true))
            coEvery { repo.updateSlug(any(), any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", slug = "s")))
            coEvery { repo.createEventType(any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))
            val vm = vm()
            vm.onSlugChange("maria-k")
            advanceUntilIdle()
            vm.onPrimary() // Link -> Type
            advanceUntilIdle()
            vm.onPrimary() // Type -> Hours
            advanceUntilIdle()
            assertEquals(3, vm.state.value.step)
        }

    @Test
    fun `step 1 primary disabled until slug available`() =
        runTest(dispatcher) {
            val vm = vm()
            assertTrue(!vm.chrome.primaryCtaEnabled)
        }
}
