@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.HomeTaskCapabilitiesDto
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomeTaskCreateScope
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.data.homes.PendingHomeTaskCreate
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AddHouseholdTaskFormViewModelTest {
    private val members = mockk<HomeMembersRepository>()
    private val creation = mockk<HomeTaskCreationCoordinator>()
    private val factory = mockk<HomeTaskCreationFactory>()
    private val access = mockk<HomeTaskAccess>()
    private val invalidated = MutableStateFlow(false)
    private val task =
        HomeTaskDto(
            "task", "home", "project", "Water plants", description = "Instructions",
            assignedTo = "member", dueAt = "2026-09-10T18:32:00-07:00", recurrenceRule = "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=7",
            capabilities = HomeTaskCapabilitiesDto(canEdit = true),
        )
    private val pending =
        PendingHomeTaskCreate(
            HomeTaskCreateScope("https://app.test", "actor", "home"),
            CreateHomeTaskRequest("chore", "Original task", requestId = "original-id"),
        )

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { factory.create("home", any()) } returns creation
        every { creation.access } returns access
        every { creation.pending } returns null
        every { creation.canClear } returns false
        every { access.isCurrent } answers { !invalidated.value }
        every { access.invalidated } returns invalidated
        coEvery { access.requireCurrent() } coAnswers {
            currentCoroutineContext().ensureActive()
            check(!invalidated.value)
        }
        coEvery { creation.load() } returns null
        coEvery { access.read("task") } returns task
        coEvery { members.listOccupants("home") } returns NetworkResult.Success(OccupantsResponse(emptyList(), emptyList()))
    }

    @After fun teardown() {
        Dispatchers.resetMain()
    }

    private fun vm(
        edit: Boolean = false,
        load: Boolean = true,
    ): AddHouseholdTaskFormViewModel {
        val state = SavedStateHandle(mapOf("homeId" to "home", "taskId" to if (edit) "task" else null))
        return AddHouseholdTaskFormViewModel(factory, members, state).also { if (load) it.load() }
    }

    @Test fun add_defaults_and_required_title() =
        runTest {
            val vm = vm()
            assertEquals(AddHouseholdTaskRecurrence.OneTime, vm.selectedRecurrence)
            assertEquals(AddHouseholdTaskFormCategory.Other, vm.selectedCategory)
            assertNull(vm.selectedAssigneeId)
            assertFalse(vm.isValid)
            assertTrue(vm.isDirty)
        }

    @Test fun denied_member_roster_keeps_authorized_unassigned_creation_available() =
        runTest {
            coEvery { members.listOccupants("home") } returns NetworkResult.Failure(NetworkError.ClientError(403, "Denied"))
            val body = slot<CreateHomeTaskRequest>()
            coEvery { creation.submit(capture(body)) } returns task
            val vm = vm()
            assertEquals(AddHouseholdTaskFormUiState.Editing, vm.state.value)
            assertTrue(vm.memberListUnavailable.value)
            assertTrue(vm.assignableMembers.value.isEmpty())
            assertNull(vm.selectedAssigneeId)
            vm.update(AddHouseholdTaskField.Title, "Restock towels")
            vm.save()
            assertNull(body.captured.assignedTo)
            assertEquals("Restock towels", body.captured.title)
        }

    @Test fun member_roster_failure_is_distinct_from_a_successful_empty_roster_and_retires_on_pause() =
        runTest {
            coEvery { members.listOccupants("home") } returns NetworkResult.Failure(NetworkError.Server(503, "Unavailable"))
            val vm = vm()
            assertTrue(vm.memberListUnavailable.value)
            vm.pause()
            assertFalse(vm.memberListUnavailable.value)
            coEvery { members.listOccupants("home") } returns NetworkResult.Success(OccupantsResponse(emptyList(), emptyList()))
            vm.resume()
            assertEquals(AddHouseholdTaskFormUiState.Editing, vm.state.value)
            assertFalse(vm.memberListUnavailable.value)
            assertTrue(vm.assignableMembers.value.isEmpty())
        }

    @Test fun denied_member_roster_preserves_an_existing_task_assignment_on_title_only_edit() =
        runTest {
            coEvery { members.listOccupants("home") } returns NetworkResult.Failure(NetworkError.ClientError(403, "Denied"))
            val body = slot<HomeTaskEditPatch>()
            coEvery { access.edit("task", capture(body)) } returns task.copy(title = "Restock towels")
            val vm = vm(edit = true)
            assertTrue(vm.memberListUnavailable.value)
            assertEquals(task.assignedTo, vm.selectedAssigneeId)
            vm.update(AddHouseholdTaskField.Title, "Restock towels")
            vm.save()
            assertEquals(mapOf("title" to "Restock towels"), body.captured.fields)
        }

    @Test fun title_and_custom_interval_validation() =
        runTest {
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "x".repeat(81))
            assertNotNull(vm.fields.value[AddHouseholdTaskField.Title]?.error)
            vm.update(AddHouseholdTaskField.Title, "x".repeat(80))
            assertNull(vm.fields.value[AddHouseholdTaskField.Title]?.error)
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Custom)
            for (bad in listOf("abc", "0", "366")) {
                vm.update(AddHouseholdTaskField.CustomInterval, bad)
                assertNotNull(vm.fields.value[AddHouseholdTaskField.CustomInterval]?.error)
            }
            vm.update(AddHouseholdTaskField.CustomInterval, "3")
            assertNull(vm.fields.value[AddHouseholdTaskField.CustomInterval]?.error)
        }

    @Test fun custom_fields_hide_and_reset_after_switching_recurrence() =
        runTest {
            val vm = vm()
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Custom)
            assertTrue(vm.showsCustomRecurrenceSubForm)
            vm.update(AddHouseholdTaskField.CustomInterval, "3")
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Weekly)
            assertFalse(vm.showsCustomRecurrenceSubForm)
            assertEquals("1", vm.fields.value[AddHouseholdTaskField.CustomInterval]?.value)
        }

    @Test fun recurrence_parser_preserves_supported_choices_for_display() {
        for ((rule, expected) in listOf(
            null to AddHouseholdTaskRecurrence.OneTime,
            " " to AddHouseholdTaskRecurrence.OneTime,
            "FREQ=DAILY" to AddHouseholdTaskRecurrence.Daily,
            "FREQ=WEEKLY" to AddHouseholdTaskRecurrence.Weekly,
            "FREQ=MONTHLY" to AddHouseholdTaskRecurrence.Monthly,
        )) {
            assertEquals(expected, AddHouseholdTaskFormViewModel.parseRecurrence(rule).recurrence)
        }
        val custom = AddHouseholdTaskFormViewModel.parseRecurrence("FREQ=DAILY;INTERVAL=3")
        assertEquals(AddHouseholdTaskRecurrence.Custom, custom.recurrence)
        assertEquals(3, custom.interval)
        assertEquals(AddHouseholdTaskCustomUnit.Days, custom.unit)
    }

    @Test fun edit_loads_exact_authorized_detail_and_starts_clean() =
        runTest {
            val vm = vm(edit = true)
            assertEquals(AddHouseholdTaskFormUiState.Editing, vm.state.value)
            assertEquals(task.title, vm.fields.value[AddHouseholdTaskField.Title]?.value)
            assertEquals("2026-09-10", vm.fields.value[AddHouseholdTaskField.DueAt]?.value)
            assertFalse(vm.isDirty)
            coVerify(exactly = 1) { access.read("task") }
        }

    @Test fun read_only_detail_never_opens_editing() =
        runTest {
            coEvery { access.read("task") } returns task.copy(capabilities = HomeTaskCapabilitiesDto())
            val vm = vm(edit = true)
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.Error)
            coVerify(exactly = 0) { members.listOccupants(any()) }
        }

    @Test fun denied_collection_or_failed_storage_does_not_enable_new_creation() =
        runTest {
            coEvery { creation.load() } throws IllegalStateException("Storage unavailable")
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "No write")
            vm.save()
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.Error)
            coVerify(exactly = 0) { creation.submit(any()) }
        }

    @Test fun validation_failure_shakes_without_submitting() =
        runTest {
            val vm = vm()
            val before = vm.shakeTrigger.value
            vm.save()
            assertNotEquals(before, vm.shakeTrigger.value)
            coVerify(exactly = 0) { creation.submit(any()) }
        }

    @Test fun create_forwards_one_snapshot_and_consumes_confirmation_once() =
        runTest {
            val body = slot<CreateHomeTaskRequest>()
            coEvery { creation.submit(capture(body)) } returns task
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "Wash dishes")
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Weekly)
            vm.selectAssignee("member")
            vm.setDueDate("2026-09-15")
            vm.update(AddHouseholdTaskField.Notes, "After dinner")
            vm.save()
            assertEquals("Wash dishes", body.captured.title)
            assertEquals("FREQ=WEEKLY", body.captured.recurrenceRule)
            assertEquals("member", body.captured.assignedTo)
            assertEquals("2026-09-15", body.captured.dueAt)
            assertEquals("After dinner", body.captured.description)
            assertEquals(task.id, vm.createdTaskId.value)
            assertTrue(vm.consumeCompletion())
            assertFalse(vm.consumeCompletion())
            vm.save()
            coVerify(exactly = 1) { creation.submit(any()) }
        }

    @Test fun custom_create_captures_interval() =
        runTest {
            val body = slot<CreateHomeTaskRequest>()
            coEvery { creation.submit(capture(body)) } returns task
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "Water plants")
            vm.selectRecurrence(AddHouseholdTaskRecurrence.Custom)
            vm.selectCustomUnit(AddHouseholdTaskCustomUnit.Days)
            vm.update(AddHouseholdTaskField.CustomInterval, "3")
            vm.save()
            assertEquals("FREQ=DAILY;INTERVAL=3", body.captured.recurrenceRule)
        }

    @Test fun title_only_edit_preserves_exact_existing_schedule_and_type() =
        runTest {
            val body = slot<HomeTaskEditPatch>()
            coEvery { access.edit("task", capture(body)) } returns task.copy(title = "New title")
            val vm = vm(edit = true)
            vm.update(AddHouseholdTaskField.Title, "New title")
            vm.save()
            assertEquals(mapOf("title" to "New title"), body.captured.fields)
            assertTrue(vm.shouldDismiss.value)
        }

    @Test fun explicit_nullable_clears_and_category_change_are_sparse() =
        runTest {
            val body = slot<HomeTaskEditPatch>()
            coEvery { access.edit("task", capture(body)) } returns task
            val vm = vm(edit = true)
            vm.selectAssignee(null)
            vm.setDueDate(null)
            vm.update(AddHouseholdTaskField.Notes, "")
            vm.selectRecurrence(AddHouseholdTaskRecurrence.OneTime)
            vm.selectCategory(AddHouseholdTaskFormCategory.Shopping)
            vm.save()
            assertEquals(
                mapOf(
                    "assigned_to" to null,
                    "due_at" to null,
                    "description" to null,
                    "recurrence_rule" to null,
                    "task_type" to "shopping",
                ),
                body.captured.fields,
            )
        }

    @Test fun update_unknown_result_requires_reload_and_never_optimistic_success() =
        runTest {
            coEvery { access.edit("task", any()) } throws NetworkError.Server(503, "unknown")
            val vm = vm(edit = true)
            vm.update(AddHouseholdTaskField.Title, "Unknown")
            vm.save()
            assertFalse(vm.shouldDismiss.value)
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.EditRecovery)
            vm.save()
            coVerify(exactly = 1) { access.edit("task", any()) }
        }

    @Test fun reopened_saved_creation_is_read_only_until_explicit_retry() =
        runTest {
            coEvery { creation.load() } returns pending
            every { creation.pending } returns pending
            coEvery { creation.submit(pending.request) } returns task
            val vm = vm()
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.Recovery)
            vm.update(AddHouseholdTaskField.Title, "Replacement")
            vm.save()
            coVerify(exactly = 0) { creation.submit(any()) }
            vm.retryCreation()
            coVerify(exactly = 1) { creation.submit(pending.request) }
        }

    @Test fun unknown_creation_keeps_original_and_blocks_new_payload() =
        runTest {
            coEvery { creation.submit(any()) } coAnswers {
                every { creation.pending } returns pending
                throw NetworkError.ClientError(429, "Try later")
            }
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "Original task")
            vm.save()
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.Recovery)
            vm.update(AddHouseholdTaskField.Title, "Replacement")
            assertEquals("Original task", vm.fields.value[AddHouseholdTaskField.Title]?.value)
            vm.save()
            coVerify(exactly = 1) { creation.submit(any()) }
        }

    @Test fun double_tap_or_leave_during_create_cannot_publish_late_success() =
        runTest {
            val reply = CompletableDeferred<HomeTaskDto>()
            coEvery { creation.submit(any()) } coAnswers { withContext(NonCancellable) { reply.await() } }
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "One task")
            vm.save()
            vm.save()
            coVerify(exactly = 1) { creation.submit(any()) }
            vm.pause()
            reply.complete(task)
            assertFalse(vm.shouldDismiss.value)
            assertFalse(vm.consumeCompletion())
            assertNull(vm.createdTaskId.value)
        }

    @Test fun session_invalidation_hides_loaded_fields_and_rejects_picker_callbacks() =
        runTest {
            val vm = vm(edit = true)
            invalidated.value = true
            vm.setDueDate("2030-01-01")
            assertTrue(vm.fields.value.isEmpty())
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.Error)
            assertFalse(vm.consumeCompletion())
        }

    @Test fun leave_before_scheduled_navigation_retires_confirmation() =
        runTest {
            coEvery { creation.submit(any()) } returns task
            val vm = vm()
            vm.update(AddHouseholdTaskField.Title, "Task")
            vm.save()
            vm.pause()
            assertFalse(vm.consumeCompletion())
        }

    @Test fun explicit_rejected_request_clear_closes_without_a_created_task_id() =
        runTest {
            coEvery { creation.load() } returns pending
            every { creation.pending } returns pending
            every { creation.canClear } returns true
            coEvery { creation.clearRejectedRequest() } returns Unit
            val vm = vm()
            vm.clearRejectedCreation()
            assertTrue(vm.consumeCompletion())
            assertNull(vm.createdTaskId.value)
            coVerify(exactly = 0) { creation.submit(any()) }
        }

    @Test fun dirty_edit_survives_foreground_reload_without_rewriting_untouched_schedule() =
        runTest {
            val body = slot<HomeTaskEditPatch>()
            coEvery { access.edit("task", capture(body)) } returns task
            val vm = vm(edit = true)
            vm.update(AddHouseholdTaskField.Title, "My unfinished edit")
            vm.pause()
            coEvery { access.read("task") } returns task.copy(description = "New current notes", dueAt = "2026-10-02T23:42:00Z")
            vm.resume()
            assertEquals("My unfinished edit", vm.fields.value[AddHouseholdTaskField.Title]?.value)
            assertEquals("New current notes", vm.fields.value[AddHouseholdTaskField.Notes]?.value)
            vm.save()
            assertEquals(mapOf("title" to "My unfinished edit"), body.captured.fields)
        }

    @Test fun unknown_edit_keeps_original_sparse_patch_for_explicit_retry_after_reload() =
        runTest {
            val body = slot<HomeTaskEditPatch>()
            coEvery { access.edit("task", capture(body)) } throws NetworkError.Server(503, "Unknown")
            val vm = vm(edit = true)
            vm.setDueDate(null)
            vm.save()
            val original = body.captured
            vm.pause()
            vm.resume()
            assertTrue(vm.state.value is AddHouseholdTaskFormUiState.EditRecovery)
            vm.setDueDate("2030-01-01")
            coEvery { access.edit("task", capture(body)) } returns task.copy(dueAt = null)
            vm.retryEdit()
            assertEquals(original, body.captured)
            assertTrue(vm.shouldDismiss.value)
        }
}
