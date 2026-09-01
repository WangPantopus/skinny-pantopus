@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

/**
 * Covers the Household tasks VM (T6.3c / P11):
 *  - four-state transitions (loading / loaded / empty / error)
 *  - tab filtering (Active / Done / Recurring) including the 30-day
 *    rolling window on Done and the `recurrence_rule != null` rule on
 *    Recurring (deviates from the prompt's `template_id != null` spec —
 *    `template_id` doesn't exist on the live `HomeTask` schema)
 *  - row projection (chip / subtitle / leading variant by assignee)
 *  - banner summary (due today + overdue)
 *  - chore-category inference from title
 *  - human recurrence rendering
 *  - optimistic toggleDone() roll-back on failure
 *  - FAB variant + tint
 *  - topBarAction is `null` by design
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HouseholdTasksListViewModelTest {
    private val repo: HomeTasksRepository = mockk()

    /** Fixed clock so chip derivation and subtitle formatting are
     *  deterministic — 2026-05-15T12:00:00Z. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeTask(
        id: String = "t",
        title: String = "Take out trash",
        status: String = "open",
        taskType: String = "chore",
        assignedTo: String? = null,
        dueAt: String? = null,
        recurrenceRule: String? = null,
        completedAt: String? = null,
        updatedAt: String? = null,
    ) = HomeTaskDto(
        id = id,
        homeId = "home-1",
        taskType = taskType,
        title = title,
        assignedTo = assignedTo,
        dueAt = dueAt,
        recurrenceRule = recurrenceRule,
        status = status,
        completedAt = completedAt,
        updatedAt = updatedAt,
    )

    private fun makeVm(): HouseholdTasksListViewModel =
        HouseholdTasksListViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(HOUSEHOLD_TASKS_HOME_ID_KEY to "home-1")),
            clock = { fixedNow },
        )

    // ─── Four states ───────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomeTasks(any()) } returns
                NetworkResult.Success(GetHomeTasksResponse(tasks = emptyList()))
            val vm = makeVm()
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No tasks yet", empty.headline)
            assertEquals("Add a task", empty.ctaTitle)
        }

    @Test fun error_response_renders_error_state() =
        runTest {
            coEvery { repo.getHomeTasks(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_maps_to_circular_action_trailing_on_active() =
        runTest {
            coEvery { repo.getHomeTasks(any()) } returns
                NetworkResult.Success(
                    GetHomeTasksResponse(
                        tasks = listOf(makeTask(id = "t1", title = "Vacuum living room")),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections[0].rows.size)
            val row = loaded.sections[0].rows[0]
            assertEquals("t1", row.id)
            // Active trailing = the checkbox + trash pair. RN puts a
            // trash affordance on every task row, so the round-checkbox
            // now shares the trailing with a destructive icon action.
            val trailing = row.trailing as RowTrailing.IconActions
            assertEquals(PantopusIcon.Circle, trailing.primary.icon)
            assertEquals("Mark done", trailing.primary.accessibilityLabel)
            assertEquals(PantopusIcon.Trash, trailing.secondary.icon)
            assertEquals("Delete task", trailing.secondary.accessibilityLabel)
            // Unassigned → typeIcon leading with the category palette.
            val leading = row.leading as RowLeading.TypeIcon
            assertEquals(PantopusIcon.Sparkles, leading.icon)
        }

    @Test fun assigned_row_renders_avatar_leading() {
        val projection =
            HouseholdTasksListViewModel.project(
                makeTask(assignedTo = "user-abcd1234"),
                fixedNow,
            )
        assertTrue(projection.isAssigned)
        assertNotNull(projection.assigneeLabel)
        assertTrue(projection.subtitle.startsWith("Assigned to "))
    }

    // ─── Tab filtering ──────────────────────────────────────────

    @Test fun active_tab_includes_open_and_in_progress() {
        val open = makeTask(id = "t1", status = "open")
        val inProgress = makeTask(id = "t2", status = "in_progress")
        assertTrue(HouseholdTasksListViewModel.passes(open, HouseholdTasksTab.Active, fixedNow))
        assertTrue(
            HouseholdTasksListViewModel.passes(inProgress, HouseholdTasksTab.Active, fixedNow),
        )
    }

    @Test fun active_tab_excludes_done_and_canceled() {
        val done = makeTask(id = "t3", status = "done")
        val canceled = makeTask(id = "t4", status = "canceled")
        assertFalse(HouseholdTasksListViewModel.passes(done, HouseholdTasksTab.Active, fixedNow))
        assertFalse(
            HouseholdTasksListViewModel.passes(canceled, HouseholdTasksTab.Active, fixedNow),
        )
    }

    @Test fun done_tab_restricts_to_30_day_window() {
        // fixedNow = 2026-05-15. 20 days back = 2026-04-25 (in window).
        val recent = makeTask(id = "t1", status = "done", completedAt = "2026-04-25T00:00:00Z")
        assertTrue(HouseholdTasksListViewModel.passes(recent, HouseholdTasksTab.Done, fixedNow))
        // 40 days back = 2026-04-05 (out of window).
        val old = makeTask(id = "t2", status = "done", completedAt = "2026-04-05T00:00:00Z")
        assertFalse(HouseholdTasksListViewModel.passes(old, HouseholdTasksTab.Done, fixedNow))
    }

    @Test fun recurring_tab_uses_recurrence_rule_field() {
        // Per the prompt the spec calls for `template_id != null` but the
        // live HomeTask schema has no such column; recurrence is the
        // RRULE-ish `recurrence_rule` text. Empty/blank ⇒ not recurring.
        val oneOff = makeTask(id = "t1", recurrenceRule = null)
        val recurring = makeTask(id = "t2", recurrenceRule = "FREQ=WEEKLY;BYDAY=TU")
        val blank = makeTask(id = "t3", recurrenceRule = "")
        assertFalse(
            HouseholdTasksListViewModel.passes(oneOff, HouseholdTasksTab.Recurring, fixedNow),
        )
        assertTrue(
            HouseholdTasksListViewModel.passes(recurring, HouseholdTasksTab.Recurring, fixedNow),
        )
        assertFalse(
            HouseholdTasksListViewModel.passes(blank, HouseholdTasksTab.Recurring, fixedNow),
        )
    }

    // ─── Row projection ─────────────────────────────────────────

    @Test fun overdue_row_surfaces_error_chip() {
        val task = makeTask(dueAt = "2026-05-12T00:00:00Z") // 3 days late
        val projection = HouseholdTasksListViewModel.project(task, fixedNow)
        assertEquals(StatusChipVariant.ErrorVariant, projection.chipVariant)
        assertTrue(projection.chipText?.contains("late") == true)
        assertNull(projection.highlight)
    }

    @Test fun due_today_row_surfaces_warning_chip() {
        val task = makeTask(dueAt = "2026-05-15T22:00:00Z")
        val projection = HouseholdTasksListViewModel.project(task, fixedNow)
        assertEquals("Today", projection.chipText)
        assertEquals(StatusChipVariant.Warning, projection.chipVariant)
    }

    @Test fun due_tomorrow_row_surfaces_warning_chip() {
        val task = makeTask(dueAt = "2026-05-16T22:00:00Z")
        val projection = HouseholdTasksListViewModel.project(task, fixedNow)
        assertEquals("Tomorrow", projection.chipText)
        assertEquals(StatusChipVariant.Warning, projection.chipVariant)
    }

    @Test fun due_later_this_week_row_surfaces_neutral_chip() {
        val task = makeTask(dueAt = "2026-05-19T22:00:00Z")
        val projection = HouseholdTasksListViewModel.project(task, fixedNow)
        assertEquals(StatusChipVariant.Neutral, projection.chipVariant)
        assertFalse(projection.chipText.isNullOrEmpty())
    }

    @Test fun done_row_surfaces_done_by_in_subtitle_and_muted_highlight() {
        val task =
            makeTask(
                status = "done",
                assignedTo = "user-aaaa1111",
                completedAt = "2026-05-15T10:00:00Z",
            )
        val projection = HouseholdTasksListViewModel.project(task, fixedNow)
        assertTrue(projection.subtitle.startsWith("Done by "))
        assertTrue(projection.subtitle.contains("2h ago"))
        assertEquals(RowHighlight.Muted, projection.highlight)
    }

    @Test fun canceled_row_renders_neutral_chip_and_muted_highlight() {
        val task = makeTask(status = "canceled")
        val projection = HouseholdTasksListViewModel.project(task, fixedNow)
        assertEquals("Canceled", projection.chipText)
        assertEquals(StatusChipVariant.Neutral, projection.chipVariant)
        assertEquals(RowHighlight.Muted, projection.highlight)
    }

    // ─── Banner summary ─────────────────────────────────────────

    @Test fun banner_summary_counts_overdue_and_due_today() {
        val tasks =
            listOf(
                makeTask(id = "t1", status = "open", dueAt = "2026-05-13T00:00:00Z"),
                makeTask(id = "t2", status = "open", dueAt = "2026-05-12T00:00:00Z"),
                makeTask(id = "t3", status = "open", dueAt = "2026-05-15T18:00:00Z"),
                makeTask(id = "t4", status = "open", dueAt = "2026-05-20T00:00:00Z"),
                makeTask(id = "t5", status = "done", dueAt = "2026-05-15T00:00:00Z"),
            )
        val summary = HouseholdTasksListViewModel.summarize(tasks, fixedNow)
        assertEquals(2, summary.overdueCount)
        assertEquals(1, summary.dueTodayCount)
        assertTrue(summary.hasContent)
    }

    @Test fun banner_has_content_false_when_all_future() {
        val tasks = listOf(makeTask(id = "t1", status = "open", dueAt = "2026-05-20T00:00:00Z"))
        val summary = HouseholdTasksListViewModel.summarize(tasks, fixedNow)
        assertFalse(summary.hasContent)
    }

    // ─── Category inference ─────────────────────────────────────

    @Test fun category_inference_cleaning_from_title() {
        assertEquals(HouseholdTaskCategory.Cleaning, HouseholdTaskCategory.from("Vacuum living room"))
        assertEquals(HouseholdTaskCategory.Cleaning, HouseholdTaskCategory.from("Mop the kitchen floor"))
    }

    @Test fun category_inference_trash_from_title() {
        assertEquals(HouseholdTaskCategory.Trash, HouseholdTaskCategory.from("Take out trash"))
        assertEquals(HouseholdTaskCategory.Trash, HouseholdTaskCategory.from("Recycling pickup"))
    }

    @Test fun category_inference_kitchen_from_title() {
        assertEquals(HouseholdTaskCategory.Kitchen, HouseholdTaskCategory.from("Empty the dishwasher"))
    }

    @Test fun category_inference_laundry_from_title() {
        assertEquals(HouseholdTaskCategory.Laundry, HouseholdTaskCategory.from("Do the laundry"))
    }

    @Test fun category_inference_yard_from_title() {
        assertEquals(
            HouseholdTaskCategory.Yard,
            HouseholdTaskCategory.from("Water plants on the porch"),
        )
    }

    @Test fun category_inference_pet_from_title() {
        assertEquals(HouseholdTaskCategory.Pet, HouseholdTaskCategory.from("Walk the dog"))
    }

    @Test fun category_inference_errand_from_title() {
        assertEquals(HouseholdTaskCategory.Errand, HouseholdTaskCategory.from("Costco run"))
    }

    @Test fun category_inference_kids_from_title() {
        assertEquals(
            HouseholdTaskCategory.Kids,
            HouseholdTaskCategory.from("Pack lunchboxes for school"),
        )
    }

    @Test fun category_inference_falls_back_to_other() {
        assertEquals(HouseholdTaskCategory.Other, HouseholdTaskCategory.from("Random thing"))
        assertEquals(HouseholdTaskCategory.Other, HouseholdTaskCategory.from(null))
    }

    @Test fun category_inference_uses_task_type_hint_for_blank_title() {
        assertEquals(
            HouseholdTaskCategory.Errand,
            HouseholdTaskCategory.from(null, "shopping"),
        )
    }

    // ─── Recurrence rendering ──────────────────────────────────

    @Test fun human_recurrence_parses_weekly_byday() {
        assertEquals(
            "Weekly · Tue",
            HouseholdTasksListViewModel.humanRecurrence("FREQ=WEEKLY;BYDAY=TU"),
        )
    }

    @Test fun human_recurrence_parses_daily() {
        assertEquals("Daily", HouseholdTasksListViewModel.humanRecurrence("FREQ=DAILY"))
    }

    @Test fun human_recurrence_passes_through_human_string() {
        assertEquals("Every 3 days", HouseholdTasksListViewModel.humanRecurrence("Every 3 days"))
    }

    @Test fun human_recurrence_null_for_empty() {
        assertNull(HouseholdTasksListViewModel.humanRecurrence(null))
        assertNull(HouseholdTasksListViewModel.humanRecurrence(""))
    }

    // ─── Optimistic toggle ─────────────────────────────────────

    @Test fun toggle_done_rolls_back_on_failure() =
        runTest {
            coEvery { repo.getHomeTasks(any()) } returns
                NetworkResult.Success(
                    GetHomeTasksResponse(
                        tasks =
                            listOf(
                                makeTask(
                                    id = "t1",
                                    title = "Vacuum",
                                    status = "open",
                                    dueAt = "2026-05-15T18:00:00Z",
                                ),
                            ),
                    ),
                )
            coEvery { repo.updateHomeTask(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            vm.toggleDone("t1")
            // After roll-back the row should still be on Active.
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections[0].rows.size)
            assertEquals("t1", loaded.sections[0].rows[0].id)
        }

    // ─── Tab counts + FAB ──────────────────────────────────────

    @Test fun tab_counts_reflect_status_buckets() =
        runTest {
            coEvery { repo.getHomeTasks(any()) } returns
                NetworkResult.Success(
                    GetHomeTasksResponse(
                        tasks =
                            listOf(
                                makeTask(
                                    id = "t1",
                                    title = "Trash",
                                    status = "open",
                                    recurrenceRule = "FREQ=WEEKLY;BYDAY=TU",
                                ),
                                makeTask(id = "t2", title = "Vacuum", status = "open"),
                                makeTask(
                                    id = "t3",
                                    title = "Dishwasher",
                                    status = "done",
                                    completedAt = "2026-05-14T10:00:00Z",
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val tabs = vm.tabs.value
            assertEquals(2, tabs[0].count) // active: t1, t2
            assertEquals(1, tabs[1].count) // done: t3
            assertEquals(1, tabs[2].count) // recurring: t1
        }

    @Test fun fab_uses_secondary_create_variant_and_home_tint() {
        val vm = makeVm()
        val fab = vm.fab()
        assertEquals(FabVariant.SecondaryCreate, fab.variant)
        assertEquals(FabTint.Home, fab.tint)
    }

    @Test fun top_bar_action_is_null_by_design() {
        val vm = makeVm()
        assertNull(vm.topBarAction)
    }

    // ─── Tab response payload simulating the success of a toggle ───

    @Test fun toggle_done_success_response_persists_through_round_trip() =
        runTest {
            coEvery { repo.getHomeTasks(any()) } returns
                NetworkResult.Success(
                    GetHomeTasksResponse(
                        tasks =
                            listOf(
                                makeTask(
                                    id = "t1",
                                    title = "Vacuum",
                                    status = "open",
                                ),
                            ),
                    ),
                )
            coEvery { repo.updateHomeTask(any(), any(), any()) } returns
                NetworkResult.Success(
                    HomeTaskResponse(
                        task = makeTask(id = "t1", title = "Vacuum", status = "done"),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.toggleDone("t1")
            // After the success the Active tab should now be empty.
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
            // And the Done tab should pick up the row.
            vm.selectTab(HouseholdTasksTab.Done.id)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("t1", loaded.sections[0].rows[0].id)
        }
}
