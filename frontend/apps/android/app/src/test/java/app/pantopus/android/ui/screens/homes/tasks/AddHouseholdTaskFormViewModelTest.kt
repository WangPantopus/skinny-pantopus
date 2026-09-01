@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomeTasksRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Covers `AddHouseholdTaskFormViewModel` for both Add and Edit modes:
 *   - initial pose (Add: empty; Edit: prefilled)
 *   - validation (title required + 80 char, custom interval ≥ 1)
 *   - recurrence parsing round-trip
 *   - custom sub-form visibility flag
 *   - submit happy path (POST + PUT body assertions)
 *   - submit error surface
 *   - dirty / valid gating
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AddHouseholdTaskFormViewModelTest {
    private val tasksRepo: HomeTasksRepository = mockk()
    private val membersRepo: HomeMembersRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun savedState(taskId: String? = null): SavedStateHandle {
        val map = mutableMapOf<String, Any?>(ADD_HOUSEHOLD_TASK_HOME_ID_KEY to "home-1")
        if (taskId != null) map[ADD_HOUSEHOLD_TASK_TASK_ID_KEY] = taskId
        return SavedStateHandle(map)
    }

    private fun stubMembers(success: Boolean = true) {
        if (success) {
            coEvery { membersRepo.listOccupants("home-1") } returns
                NetworkResult.Success(
                    OccupantsResponse(
                        occupants =
                            listOf(
                                OccupantDto(
                                    id = "occ-1",
                                    userId = "user-1",
                                    role = "owner",
                                    isActive = true,
                                    displayName = "Maria Kovács",
                                    username = "mariak",
                                ),
                                OccupantDto(
                                    id = "occ-2",
                                    userId = "user-2",
                                    role = "member",
                                    isActive = true,
                                    displayName = "Avery Park",
                                    username = "averyp",
                                ),
                            ),
                        pendingInvites = emptyList(),
                    ),
                )
        } else {
            coEvery { membersRepo.listOccupants("home-1") } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
        }
    }

    private fun makeVm(taskId: String? = null): AddHouseholdTaskFormViewModel =
        AddHouseholdTaskFormViewModel(
            tasksRepo = tasksRepo,
            membersRepo = membersRepo,
            savedStateHandle = savedState(taskId),
        )

    private fun task(
        id: String = "task-1",
        title: String = "Take out trash",
        recurrenceRule: String? = null,
        taskType: String = "chore",
        assignedTo: String? = "user-1",
        dueAt: String? = "2026-06-01",
        description: String? = "Tuesday curbside.",
    ) = HomeTaskDto(
        id = id,
        homeId = "home-1",
        taskType = taskType,
        title = title,
        description = description,
        assignedTo = assignedTo,
        dueAt = dueAt,
        recurrenceRule = recurrenceRule,
        status = "open",
    )

    // ── Initial pose ──────────────────────────────────────────

    @Test
    fun add_mode_initial_pose_one_time_other_category() =
        runTest {
            stubMembers()
            val vm = makeVm()
            assertFalse(vm.isEditing)
            assertEquals(AddHouseholdTaskRecurrence.OneTime, vm.selectedRecurrence)
            assertEquals(AddHouseholdTaskFormCategory.Other, vm.selectedCategory)
            assertNull(vm.selectedAssigneeId)
            assertFalse(vm.showsCustomRecurrenceSubForm)
            assertNotNull(
                "Empty title should fail required validator at seed.",
                vm.fields.value[AddHouseholdTaskField.Title]?.error,
            )
            assertFalse(vm.isValid)
        }

    @Test
    fun edit_mode_hydrates_every_field_from_backend() =
        runTest {
            coEvery { tasksRepo.getHomeTasks("home-1") } returns
                NetworkResult.Success(GetHomeTasksResponse(tasks = listOf(task(recurrenceRule = "FREQ=WEEKLY"))))
            stubMembers()
            val vm = makeVm(taskId = "task-1")
            vm.load()
            assertTrue(vm.isEditing)
            assertEquals(AddHouseholdTaskFormUiState.Editing, vm.state.value)
            assertEquals("Take out trash", vm.fields.value[AddHouseholdTaskField.Title]?.value)
            assertEquals("Tuesday curbside.", vm.fields.value[AddHouseholdTaskField.Notes]?.value)
            assertEquals("user-1", vm.selectedAssigneeId)
            assertEquals("2026-06-01", vm.fields.value[AddHouseholdTaskField.DueAt]?.value)
            assertEquals(AddHouseholdTaskRecurrence.Weekly, vm.selectedRecurrence)
            // "Take out trash" → category Cleaning per the inference table.
            assertEquals(AddHouseholdTaskFormCategory.Cleaning, vm.selectedCategory)
            assertFalse(vm.isDirty)
            assertTrue(vm.isValid)
        }

    @Test
    fun edit_mode_missing_task_surfaces_error() =
        runTest {
            coEvery { tasksRepo.getHomeTasks("home-1") } returns
                NetworkResult.Success(GetHomeTasksResponse(tasks = emptyList()))
            val vm = makeVm(taskId = "task-1")
            vm.load()
            val state = vm.state.value
            assertTrue(state is AddHouseholdTaskFormUiState.Error)
            assertEquals("Couldn't find that task.", (state as AddHouseholdTaskFormUiState.Error).message)
        }

    // ── Validators ─────────────────────────────────────────────

    @Test
    fun title_required_and_max_length_80() =
        runTest {
            stubMembers()
            val vm = makeVm()
            vm.update(AddHouseholdTaskField.Title, "")
            assertNotNull(vm.fields.value[AddHouseholdTaskField.Title]?.error)
            vm.update(AddHouseholdTaskField.Title, "a".repeat(81))
            assertNotNull(vm.fields.value[AddHouseholdTaskField.Title]?.error)
            vm.update(AddHouseholdTaskField.Title, "a".repeat(80))
            assertNull(vm.fields.value[AddHouseholdTaskField.Title]?.error)
            vm.update(AddHouseholdTaskField.Title, "Wash dishes")
            assertNull(vm.fields.value[AddHouseholdTaskField.Title]?.error)
        }

    @Test
    fun custom_interval_validator_only_active_on_custom_recurrence() =
        runTest {
            stubMembers()
            val vm = makeVm()
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Weekly)
            vm.update(AddHouseholdTaskField.CustomInterval, "abc")
            assertNull(
                "Custom validator should not fire when recurrence != Custom.",
                vm.fields.value[AddHouseholdTaskField.CustomInterval]?.error,
            )
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Custom)
            vm.update(AddHouseholdTaskField.CustomInterval, "abc")
            assertNotNull(vm.fields.value[AddHouseholdTaskField.CustomInterval]?.error)
            vm.update(AddHouseholdTaskField.CustomInterval, "0")
            assertNotNull(vm.fields.value[AddHouseholdTaskField.CustomInterval]?.error)
            vm.update(AddHouseholdTaskField.CustomInterval, "3")
            assertNull(vm.fields.value[AddHouseholdTaskField.CustomInterval]?.error)
        }

    @Test
    fun custom_sub_form_visibility_tracks_recurrence_picker() =
        runTest {
            stubMembers()
            val vm = makeVm()
            assertFalse(vm.showsCustomRecurrenceSubForm)
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Daily)
            assertFalse(vm.showsCustomRecurrenceSubForm)
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Custom)
            assertTrue(vm.showsCustomRecurrenceSubForm)
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Weekly)
            assertFalse(
                "Sub-form should hide once the user picks a fixed cadence.",
                vm.showsCustomRecurrenceSubForm,
            )
        }

    // ── Recurrence parsing ─────────────────────────────────────

    @Test fun parse_recurrence_returns_one_time_for_null_or_empty() {
        val nilResult = AddHouseholdTaskFormViewModel.parseRecurrence(null)
        assertEquals(AddHouseholdTaskRecurrence.OneTime, nilResult.recurrence)
        val emptyResult = AddHouseholdTaskFormViewModel.parseRecurrence("  ")
        assertEquals(AddHouseholdTaskRecurrence.OneTime, emptyResult.recurrence)
    }

    @Test fun parse_recurrence_freq_only_rules_map_to_simple_options() {
        assertEquals(
            AddHouseholdTaskRecurrence.Daily,
            AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=DAILY").recurrence,
        )
        assertEquals(
            AddHouseholdTaskRecurrence.Weekly,
            AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=WEEKLY").recurrence,
        )
        assertEquals(
            AddHouseholdTaskRecurrence.Monthly,
            AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=MONTHLY").recurrence,
        )
    }

    @Test fun parse_recurrence_interval_greater_than_1_maps_to_custom() {
        val parsed = AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=DAILY;INTERVAL=3")
        assertEquals(AddHouseholdTaskRecurrence.Custom, parsed.recurrence)
        assertEquals(3, parsed.interval)
        assertEquals(AddHouseholdTaskCustomUnit.Days, parsed.unit)
    }

    // ── Submit happy path ─────────────────────────────────────

    @Test
    fun add_mode_save_posts_expected_body_and_signals_dismiss() =
        runTest {
            stubMembers()
            val capturedRequest = slot<CreateHomeTaskRequest>()
            coEvery { tasksRepo.createHomeTask("home-1", capture(capturedRequest)) } returns
                NetworkResult.Success(
                    HomeTaskResponse(
                        task =
                            HomeTaskDto(
                                id = "task-new",
                                homeId = "home-1",
                                taskType = "chore",
                                title = "Wash dishes",
                                status = "open",
                            ),
                    ),
                )

            val vm = makeVm()
            vm.update(AddHouseholdTaskField.Title, "Wash dishes")
            vm.selectCategory(AddHouseholdTaskFormCategory.Cleaning)
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Weekly)
            vm.selectAssignee("user-1")
            vm.setDueDate("2026-06-15")
            vm.update(AddHouseholdTaskField.Notes, "After dinner.")

            vm.save()

            assertEquals("task-new", vm.createdTaskId.value)
            assertTrue(vm.shouldDismiss.value)
            assertFalse(vm.toast.value?.isError ?: true)

            val body = capturedRequest.captured
            assertEquals("Wash dishes", body.title)
            assertEquals("chore", body.taskType)
            assertEquals("user-1", body.assignedTo)
            assertEquals("2026-06-15", body.dueAt)
            assertEquals("After dinner.", body.description)
            assertEquals("FREQ=WEEKLY", body.recurrenceRule)
        }

    @Test
    fun edit_mode_save_puts_expected_body() =
        runTest {
            coEvery { tasksRepo.getHomeTasks("home-1") } returns
                NetworkResult.Success(GetHomeTasksResponse(tasks = listOf(task(recurrenceRule = null))))
            stubMembers()
            val capturedRequest = slot<UpdateHomeTaskRequest>()
            coEvery {
                tasksRepo.updateHomeTask("home-1", "task-1", capture(capturedRequest))
            } returns
                NetworkResult.Success(
                    HomeTaskResponse(task = task(recurrenceRule = "FREQ=WEEKLY", title = "Take out trash (Tuesday)")),
                )

            val vm = makeVm(taskId = "task-1")
            vm.load()
            vm.update(AddHouseholdTaskField.Title, "Take out trash (Tuesday)")
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Weekly)

            vm.save()

            assertTrue(vm.shouldDismiss.value)
            assertFalse(vm.toast.value?.isError ?: true)
            val body = capturedRequest.captured
            assertEquals("Take out trash (Tuesday)", body.title)
            assertEquals("FREQ=WEEKLY", body.recurrenceRule)
            assertEquals("Tuesday curbside.", body.description)
            assertEquals("user-1", body.assignedTo)
        }

    @Test
    fun add_mode_custom_recurrence_builds_interval_rule() =
        runTest {
            stubMembers()
            val capturedRequest = slot<CreateHomeTaskRequest>()
            coEvery { tasksRepo.createHomeTask("home-1", capture(capturedRequest)) } returns
                NetworkResult.Success(
                    HomeTaskResponse(
                        task =
                            HomeTaskDto(
                                id = "task-new",
                                homeId = "home-1",
                                taskType = "chore",
                                title = "Water plants",
                                status = "open",
                            ),
                    ),
                )

            val vm = makeVm()
            vm.update(AddHouseholdTaskField.Title, "Water plants")
            vm.selectCategory(AddHouseholdTaskFormCategory.Yardwork)
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Custom)
            vm.selectCustomUnit(AddHouseholdTaskCustomUnit.Days)
            vm.update(AddHouseholdTaskField.CustomInterval, "3")

            vm.save()
            val body = capturedRequest.captured
            assertEquals("FREQ=DAILY;INTERVAL=3", body.recurrenceRule)
            assertEquals("chore", body.taskType)
        }

    // ── Submit failure ────────────────────────────────────────

    @Test
    fun save_validation_error_shakes_and_does_not_fire() =
        runTest {
            stubMembers()
            val vm = makeVm()
            val before = vm.shakeTrigger.value
            vm.save() // title is empty — must fail
            assertNotEquals(before, vm.shakeTrigger.value)
            assertFalse(vm.shouldDismiss.value)
            coVerify(exactly = 0) { tasksRepo.createHomeTask(any(), any()) }
        }

    @Test
    fun save_server_error_surfaces_toast() =
        runTest {
            stubMembers()
            coEvery { tasksRepo.createHomeTask("home-1", any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))

            val vm = makeVm()
            vm.update(AddHouseholdTaskField.Title, "Wash dishes")
            vm.save()
            assertTrue(vm.toast.value?.isError ?: false)
            assertFalse(vm.shouldDismiss.value)
        }

    // ── Dirty gating ──────────────────────────────────────────

    @Test
    fun edit_mode_isDirty_true_only_after_edit() =
        runTest {
            coEvery { tasksRepo.getHomeTasks("home-1") } returns
                NetworkResult.Success(GetHomeTasksResponse(tasks = listOf(task(recurrenceRule = "FREQ=DAILY"))))
            stubMembers()
            val vm = makeVm(taskId = "task-1")
            vm.load()
            assertFalse(vm.isDirty)
            vm.update(AddHouseholdTaskField.Title, "Take out trash NOW")
            assertTrue(vm.isDirty)
        }

    @Test
    fun add_mode_isDirty_always_true_so_save_can_fire_on_first_edit() =
        runTest {
            stubMembers()
            val vm = makeVm()
            assertTrue(
                "Add mode treats every field as new so Save is reachable from the start.",
                vm.isDirty,
            )
        }
}
