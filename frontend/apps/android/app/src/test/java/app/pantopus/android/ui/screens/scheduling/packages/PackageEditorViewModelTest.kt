@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.CreatePackageRequest
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.GetPackagesResponse
import app.pantopus.android.data.api.models.scheduling.PackageDto
import app.pantopus.android.data.api.models.scheduling.PackageResponse
import app.pantopus.android.data.api.models.scheduling.UpdatePackageRequest
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PackageEditorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }
    private val relay = PackagesOwnerRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user()))
        coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun user() = UserDto(id = "biz-1", email = "a@b.com", displayName = "A", avatarUrl = null)

    private fun handle(id: String) = SavedStateHandle(mapOf(SchedulingRoutes.ARG_PACKAGE_ID to id))

    private fun vm(id: String) = PackageEditorViewModel(handle(id), repo, auth, errors, flags, relay)

    private fun pkg() = PackageDto(id = "p1", name = "5 cleans", sessionsCount = 5, priceCents = 22000, currency = "USD", isActive = true)

    @Test
    fun `create mode starts blank and invalid`() =
        runTest(dispatcher) {
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            val content = model.state.value as PackageEditorUiState.Content
            assertFalse(content.isEditing)
            assertFalse(content.isValid)
            assertEquals("", content.form.name)
        }

    @Test
    fun `a valid name enables save`() =
        runTest(dispatcher) {
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            model.onName("5-session cleaning")
            val content = model.state.value as PackageEditorUiState.Content
            assertTrue(content.isValid)
        }

    @Test
    fun `edit mode seeds from the owner package list`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg())))
            val model = vm("p1")
            model.start()
            advanceUntilIdle()
            val content = model.state.value as PackageEditorUiState.Content
            assertTrue(content.isEditing)
            assertEquals("5 cleans", content.form.name)
            assertEquals("220.00", content.form.priceText)
        }

    @Test
    fun `save in create mode posts a new package`() =
        runTest(dispatcher) {
            val body = slot<CreatePackageRequest>()
            coEvery { repo.createPackage(any(), capture(body)) } returns NetworkResult.Success(PackageResponse(pkg()))
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            model.onName("New pack")
            model.onSessions(3)
            model.onPrice("99")
            var done = false
            model.save { done = true }
            advanceUntilIdle()
            coVerify { repo.createPackage(any(), any()) }
            assertEquals("New pack", body.captured.name)
            assertEquals(3, body.captured.sessionsCount)
            assertEquals(9900, body.captured.priceCents)
            assertTrue(done)
        }

    @Test
    fun `save in edit mode puts the package`() =
        runTest(dispatcher) {
            coEvery { repo.getPackages(any()) } returns NetworkResult.Success(GetPackagesResponse(listOf(pkg())))
            val body = slot<UpdatePackageRequest>()
            coEvery { repo.updatePackage(any(), eq("p1"), capture(body)) } returns NetworkResult.Success(PackageResponse(pkg()))
            val model = vm("p1")
            model.start()
            advanceUntilIdle()
            model.onName("Renamed")
            model.save { }
            advanceUntilIdle()
            coVerify { repo.updatePackage(any(), eq("p1"), any()) }
            assertEquals("Renamed", body.captured.name)
        }

    @Test
    fun `paid flag off shows coming soon`() =
        runTest(dispatcher) {
            flags.environment = "production"
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is PackageEditorUiState.ComingSoon)
        }
}
