@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.MessageTemplateDto
import app.pantopus.android.data.api.models.scheduling.MessageTemplateResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MessageTemplateEditorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(id: String) =
        MessageTemplateEditorViewModel(SavedStateHandle(mapOf(SchedulingRoutes.ARG_TEMPLATE_ID to id)), repo, errors)

    private fun loaded(vm: MessageTemplateEditorViewModel) = vm.state.value as MessageTemplateEditorUiState.Loaded

    @Test
    fun `email requires a subject`() =
        runTest(dispatcher) {
            val vm = vm("new")
            vm.start()
            advanceUntilIdle()
            vm.setChannel(WorkflowChannel.Email)
            vm.onName("Thank-you")
            vm.onBody("Thanks {{attendee_name}}")
            assertTrue(loaded(vm).form.subjectMissing)
            assertFalse(loaded(vm).canSave)

            vm.onSubject("Thanks for booking")
            assertFalse(loaded(vm).form.subjectMissing)
            assertTrue(loaded(vm).canSave)
        }

    @Test
    fun `push template needs no subject`() =
        runTest(dispatcher) {
            val vm = vm("new")
            vm.start()
            advanceUntilIdle()
            vm.setChannel(WorkflowChannel.Push)
            vm.onName("Reminder")
            vm.onBody("Starting soon")
            assertFalse(loaded(vm).form.showsSubject)
            assertTrue(loaded(vm).canSave)
        }

    @Test
    fun `sms over the segment limit flags`() {
        // SMS is gated coming-soon at the channel picker (setChannel no-ops for
        // it), so exercise the over-limit counter logic on an SMS-channel form
        // directly: SMS caps at one 160-char segment.
        val form = TemplateForm(channel = WorkflowChannel.Sms, body = "a".repeat(170))
        assertTrue(form.isOverLimit)
        assertEquals(160, form.counterLimit)
    }

    @Test
    fun `save new posts template`() =
        runTest(dispatcher) {
            coEvery { repo.createMessageTemplate(any(), any()) } returns
                NetworkResult.Success(
                    MessageTemplateResponse(
                        MessageTemplateDto(
                            id = "t9",
                            name = "Confirm",
                            channel = "email",
                            subject = "Booked",
                            body = "Hi {{attendee_name}}",
                        ),
                    ),
                )
            val vm = vm("new")
            vm.start()
            advanceUntilIdle()
            vm.onName("Confirm")
            vm.onSubject("Booked")
            vm.onBody("Hi {{attendee_name}}")
            assertTrue(loaded(vm).canSave)

            vm.save()
            advanceUntilIdle()
            assertTrue(vm.saved.value)
            coVerify { repo.createMessageTemplate(any(), any()) }
        }
}
