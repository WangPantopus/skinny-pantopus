@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskDto
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskToGigResponse
import app.pantopus.android.data.api.models.mailbox.v2.P3TasksResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.mailbox.MailboxTasksRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A17.12 (list surface) — JVM unit tests for the mail-linked task list.
 * Mirrors iOS `MailTaskListViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailTaskListViewModelTest {
    private val repository = mockk<MailboxRepository>(relaxed = true)
    private val tasksRepository = mockk<MailboxTasksRepository>(relaxed = true)
    private val homesRepository = mockk<HomesRepository>(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun task(
        id: String,
        status: String,
        gigId: String? = null,
    ) = P3TaskDto(
        id = id,
        homeId = "h-1",
        mailId = "m-1",
        title = "Submit written comment",
        description = "Case ZA-2026-0188",
        priority = "high",
        status = status,
        convertedToGigId = gigId,
        mailPreview = "Notice of public hearing",
        mailSender = "City of Oakland",
    )

    private fun vm(
        mailId: String? = null,
        subject: String? = null,
        tasks: P3TasksResponse =
            P3TasksResponse(
                active = listOf(task("t-1", "pending")),
                completed = listOf(task("t-2", "completed", gigId = "g-9")),
            ),
    ): MailTaskListViewModel {
        coEvery { repository.p3Tasks(any()) } returns NetworkResult.Success(tasks)
        val handle =
            SavedStateHandle(
                mapOf(
                    MAIL_TASK_LIST_MAIL_ID_KEY to (mailId ?: MAIL_TASK_LIST_NONE),
                    MAIL_TASK_LIST_SUBJECT_KEY to (subject ?: MAIL_TASK_LIST_NONE),
                    MAIL_TASK_LIST_SENDER_KEY to MAIL_TASK_LIST_NONE,
                ),
            )
        return MailTaskListViewModel(repository, tasksRepository, homesRepository, handle)
    }

    @Test
    fun `load splits active and completed`() {
        val model = vm()
        model.load()
        val state = model.state.value as MailTaskListUiState.Loaded
        assertEquals(listOf("t-1"), state.active.map { it.id })
        assertEquals(listOf("t-2"), state.completed.map { it.id })
        assertEquals(MailTaskPriority.High, state.active.first().priority)
        assertTrue(state.completed.first().isConvertedToGig)
    }

    @Test
    fun `both buckets empty renders the empty frame`() {
        val model = vm(tasks = P3TasksResponse())
        model.load()
        assertTrue(model.state.value is MailTaskListUiState.Empty)
    }

    @Test
    fun `a failed fetch renders the error frame`() {
        coEvery { repository.p3Tasks(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
        val model =
            MailTaskListViewModel(
                repository,
                tasksRepository,
                homesRepository,
                SavedStateHandle(emptyMap()),
            )
        model.load()
        assertTrue(model.state.value is MailTaskListUiState.Error)
    }

    @Test
    fun `opening from a mail starts in the create frame seeded with the subject`() {
        val model = vm(mailId = "m-1", subject = "Notice of public hearing")
        assertEquals(MailTaskListMode.Create, model.mode.value)
        assertEquals("Notice of public hearing", model.draftTitle.value)
    }

    @Test
    fun `create requires a title`() {
        val model = vm(mailId = "m-1")
        model.updateDraftTitle("   ")
        model.create()
        assertEquals("Title Required", model.alert.value?.title)
    }

    @Test
    fun `create resolves the first home then posts from-mail`() {
        coEvery { homesRepository.myHomes() } returns
            NetworkResult.Success(MyHomesResponse(homes = listOf(home("h-1")), message = null))
        coEvery { tasksRepository.createTaskFromMail(any()) } returns
            NetworkResult.Success(P3TaskResponse(task = task("t-3", "pending")))
        val model = vm(mailId = "m-1")
        model.load()
        model.updateDraftTitle("Call the city")
        model.create()

        assertEquals(MailTaskListMode.List, model.mode.value)
        val state = model.state.value as MailTaskListUiState.Loaded
        assertEquals("t-3", state.active.first().id)
    }

    @Test
    fun `create without a home alerts`() {
        coEvery { homesRepository.myHomes() } returns
            NetworkResult.Success(MyHomesResponse(homes = emptyList(), message = null))
        val model = vm(mailId = "m-1")
        model.load()
        model.updateDraftTitle("Call the city")
        model.create()
        assertEquals("No Home", model.alert.value?.title)
    }

    @Test
    fun `toggle moves the row between buckets optimistically`() {
        // Stub the PATCH explicitly: a `relaxed` mock's return value does not
        // read as NetworkResult.Success, so the view model treats it as a
        // failure and rolls the optimistic move straight back.
        coEvery { repository.updateP3Task(any(), any()) } returns
            NetworkResult.Success(P3TaskResponse(task = task("t-1", "completed")))
        val model = vm()
        model.load()
        val row = (model.state.value as MailTaskListUiState.Loaded).active.first()
        model.toggle(row)
        val state = model.state.value as MailTaskListUiState.Loaded
        assertTrue(state.active.isEmpty())
        assertEquals("t-1", state.completed.first().id)
        assertTrue(state.completed.first().isDone)
    }

    @Test
    fun `convert to gig badges the row`() {
        coEvery { tasksRepository.convertTaskToGig(any(), any()) } returns
            NetworkResult.Success(P3TaskToGigResponse(gigId = "g-1", title = "Submit written comment"))
        val model = vm()
        model.load()
        val row = (model.state.value as MailTaskListUiState.Loaded).active.first()
        model.requestConvert(row)
        assertEquals("t-1", model.convertTarget.value?.id)
        model.confirmConvert()
        val state = model.state.value as MailTaskListUiState.Loaded
        assertTrue(state.active.first().isConvertedToGig)
        assertTrue(model.toast.value?.contains("neighbor task") == true)
    }

    @Test
    fun `convert is withheld once the task is already a gig`() {
        val model = vm()
        model.load()
        val row = (model.state.value as MailTaskListUiState.Loaded).completed.first()
        model.requestConvert(row)
        assertNull(model.convertTarget.value)
    }

    private fun home(id: String) =
        MyHome(
            id = id,
            name = "Elm St",
            address = "412 Elm St",
            city = "Oakland",
            state = "CA",
            zipcode = "94601",
            homeType = null,
            visibility = null,
            description = null,
            createdAt = null,
            updatedAt = null,
            occupancy = null,
            ownershipStatus = null,
            verificationTier = null,
            isPrimaryOwner = null,
            pendingClaimId = null,
        )
}
