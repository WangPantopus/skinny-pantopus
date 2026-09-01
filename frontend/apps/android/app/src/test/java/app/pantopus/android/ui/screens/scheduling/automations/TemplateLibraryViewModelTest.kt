@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.GetMessageTemplatesResponse
import app.pantopus.android.data.api.models.scheduling.MessageTemplateDto
import app.pantopus.android.data.api.models.scheduling.MessageTemplateResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
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
class TemplateLibraryViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = TemplateLibraryViewModel(
        repo,
        errors,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    @Test
    fun `route owner args flow into the editor route builders`() {
        val vm = vm(ownerKind = "home", ownerId = "home-3")
        assertEquals("scheduling/templates/new?ownerKind=home&ownerId=home-3", vm.createNewRoute())
        assertEquals("scheduling/templates/t9?ownerKind=home&ownerId=home-3", vm.templateRoute("t9"))
    }

    private fun mine(name: String) = MessageTemplateDto(id = "t1", name = name, channel = "email", subject = "s", body = "Hello")

    @Test
    fun `load keeps starters and loads mine`() =
        runTest(dispatcher) {
            coEvery { repo.getMessageTemplates(any()) } returns NetworkResult.Success(GetMessageTemplatesResponse(listOf(mine("Mine"))))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is TemplateLibraryUiState.Loaded)
            assertEquals(1, vm.visibleTemplates.size)
            assertEquals(StarterTemplate.all.size, vm.starters.size)
        }

    @Test
    fun `duplicate starter posts and reloads`() =
        runTest(dispatcher) {
            coEvery { repo.getMessageTemplates(any()) } returnsMany
                listOf(
                    NetworkResult.Success(GetMessageTemplatesResponse(emptyList())),
                    NetworkResult.Success(GetMessageTemplatesResponse(listOf(mine("Reminder")))),
                )
            coEvery { repo.createMessageTemplate(any(), any()) } returns NetworkResult.Success(MessageTemplateResponse(mine("Reminder")))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.visibleTemplates.isEmpty())
            vm.duplicateStarter(StarterTemplate.all[1])
            advanceUntilIdle()
            assertEquals(1, vm.visibleTemplates.size)
        }

    @Test
    fun `delete removes the row`() =
        runTest(dispatcher) {
            coEvery { repo.getMessageTemplates(any()) } returnsMany
                listOf(
                    NetworkResult.Success(GetMessageTemplatesResponse(listOf(mine("Mine")))),
                    NetworkResult.Success(GetMessageTemplatesResponse(emptyList())),
                )
            coEvery { repo.deleteMessageTemplate(any(), any()) } returns NetworkResult.Success(SchedulingOkResponse())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.confirmDelete(vm.visibleTemplates.first())
            advanceUntilIdle()
            assertTrue(vm.visibleTemplates.isEmpty())
        }

    @Test
    fun `search filters by name`() =
        runTest(dispatcher) {
            coEvery { repo.getMessageTemplates(any()) } returns NetworkResult.Success(GetMessageTemplatesResponse(listOf(mine("Welcome"))))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setQuery("welcome")
            assertEquals(1, vm.visibleTemplates.size)
            vm.setQuery("zzz")
            assertTrue(vm.visibleTemplates.isEmpty())
        }
}
