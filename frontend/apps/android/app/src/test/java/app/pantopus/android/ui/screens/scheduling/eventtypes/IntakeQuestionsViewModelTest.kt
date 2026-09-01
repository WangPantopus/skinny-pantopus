@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeQuestionDto
import app.pantopus.android.data.api.models.scheduling.QuestionsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
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
class IntakeQuestionsViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val relay = SchedulingEditorOwnerRelay()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun handle(id: String) = SavedStateHandle(mapOf("eventTypeId" to id))

    private fun vm(id: String) = IntakeQuestionsViewModel(handle(id), repo, errors, relay)

    private fun stubLoad(questions: List<EventTypeQuestionDto>) {
        val dto = EventTypeDto(id = "e1", name = "Intro call", slug = "intro", durations = listOf(30))
        coEvery { repo.getEventType(any(), "e1") } returns NetworkResult.Success(EventTypeDetailResponse(dto, questions = questions))
    }

    @Test
    fun `unsaved event type reports needs-save-first`() =
        runTest(dispatcher) {
            val model = vm("new")
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is IntakeUiState.NeedsSaveFirst)
        }

    @Test
    fun `loads existing questions into drafts`() =
        runTest(dispatcher) {
            stubLoad(
                listOf(
                    EventTypeQuestionDto(label = "What to cover?", fieldType = "textarea", required = true, sortOrder = 0),
                    EventTypeQuestionDto(label = "Phone", fieldType = "phone", required = false, sortOrder = 1),
                ),
            )
            val model = vm("e1")
            model.start()
            advanceUntilIdle()
            val c = model.state.value as IntakeUiState.Content
            assertEquals(2, c.questions.size)
            assertEquals(QuestionType.Paragraph, c.questions.first().type)
            assertFalse(c.isDirty)
        }

    @Test
    fun `adding a question marks dirty`() =
        runTest(dispatcher) {
            stubLoad(emptyList())
            val model = vm("e1")
            model.start()
            advanceUntilIdle()
            model.startAdd()
            model.onEditLabel("How did you hear about us?")
            model.saveEditing()
            val c = model.state.value as IntakeUiState.Content
            assertEquals(1, c.questions.size)
            assertTrue(c.isDirty)
        }

    @Test
    fun `editing an existing question updates it in place`() =
        runTest(dispatcher) {
            stubLoad(listOf(EventTypeQuestionDto(label = "Old label", fieldType = "text", required = false, sortOrder = 0)))
            val model = vm("e1")
            model.start()
            advanceUntilIdle()
            val target = (model.state.value as IntakeUiState.Content).questions.first()
            model.editQuestion(target.localId)
            model.onEditLabel("New label")
            model.onEditRequired(true)
            model.saveEditing()
            val c = model.state.value as IntakeUiState.Content
            assertEquals(1, c.questions.size)
            assertEquals("New label", c.questions.first().label)
            assertTrue(c.questions.first().required)
            assertTrue(c.isDirty)
        }

    @Test
    fun `done saves the full set replace-all and emits saved`() =
        runTest(dispatcher) {
            stubLoad(emptyList())
            coEvery { repo.setQuestions(any(), any(), any()) } returns NetworkResult.Success(QuestionsResponse())
            val model = vm("e1")
            model.start()
            advanceUntilIdle()
            model.startAdd()
            model.onEditLabel("Anything else?")
            model.saveEditing()
            model.save()
            advanceUntilIdle()
            assertTrue(model.saved.value)
            coVerify { repo.setQuestions(SchedulingOwner.Personal, "e1", any()) }
        }
}
