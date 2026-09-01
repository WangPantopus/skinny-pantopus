@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.scheduling.CreateResourceRequest
import app.pantopus.android.data.api.models.scheduling.GetResourcesResponse
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.models.scheduling.ResourceResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
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
class ResourceEditorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk(relaxed = true)

    @Before fun setup() {
        Dispatchers.setMain(dispatcher)
        coEvery { homes.myHomes() } returns NetworkResult.Success(homeResponse())
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun homeResponse(id: String = "home-1"): MyHomesResponse {
        val home = mockk<MyHome>(relaxed = true)
        every { home.id } returns id
        every { home.isPrimaryOwner } returns true
        return MyHomesResponse(homes = listOf(home), message = null)
    }

    private fun vm(resourceId: String) = ResourceEditorViewModel(SavedStateHandle(mapOf("resourceId" to resourceId)), repo, homes)

    @Test
    fun `create seeds defaults and is invalid until named`() =
        runTest(dispatcher) {
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            assertTrue(model.loadState.value is ResourceEditorLoadState.Ready)
            assertEquals(2, model.form.value.maxDurationHours) // Other → 120 min
            assertFalse(model.isValid)
            model.setName("EV charger")
            assertTrue(model.isValid)
        }

    @Test
    fun `selecting charger applies smart rule defaults`() =
        runTest(dispatcher) {
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            model.selectKind(ResourceKind.Charger)
            assertEquals(ResourceKind.Charger, model.form.value.kind)
            assertEquals(4, model.form.value.maxDurationHours) // 240 min
            assertFalse(model.form.value.requiresApproval)
        }

    @Test
    fun `save creates a resource scoped to the home owner`() =
        runTest(dispatcher) {
            coEvery { repo.createResource(any(), any()) } returns
                NetworkResult.Success(ResourceResponse(ResourceDto(id = "r1", name = "EV charger")))
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            model.setName("EV charger")
            model.selectKind(ResourceKind.Charger)

            model.save()
            advanceUntilIdle()

            // The write ran in viewModelScope and the one-shot Saved event is
            // buffered for the screen to dismiss on.
            assertEquals(ResourceEditorEvent.Saved, model.events.first())
            coVerify {
                repo.createResource(
                    SchedulingOwner.Home("home-1"),
                    match<CreateResourceRequest> { it.name == "EV charger" && it.resourceType == "charger" },
                )
            }
        }

    @Test
    fun `edit loads the existing resource into the form`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns
                NetworkResult.Success(
                    GetResourcesResponse(
                        listOf(
                            ResourceDto(
                                id = "r1",
                                name = "EV charger",
                                resourceType = "charger",
                                maxDurationMin = 240,
                                requiresApproval = false,
                            ),
                        ),
                    ),
                )
            val model = vm("r1")
            model.start()
            advanceUntilIdle()
            assertTrue(model.loadState.value is ResourceEditorLoadState.Ready)
            assertEquals("EV charger", model.form.value.name)
            assertEquals(ResourceKind.Charger, model.form.value.kind)
            assertFalse(model.isCreate)
        }

    @Test
    fun `missing home surfaces an error`() =
        runTest(dispatcher) {
            coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(emptyList(), null))
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            assertTrue(model.loadState.value is ResourceEditorLoadState.Error)
        }
}
