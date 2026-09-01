@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class MaintenanceListViewModelTest {
    private val repo: HomesRepository = mockk()

    /** Fixed clock — 2026-05-15T12:00:00Z. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeTask(
        id: String = "m",
        task: String = "HVAC tune-up",
        vendor: String? = "Riverside HVAC",
        cost: BigDecimal? = BigDecimal("185"),
        recurrence: String = "yearly",
        dueDate: String? = "2026-05-25T08:00:00Z",
        status: String = "scheduled",
        updatedAt: String? = null,
    ) = MaintenanceTaskDto(
        id = id,
        homeId = "home-1",
        task = task,
        vendor = vendor,
        cost = cost,
        recurrence = recurrence,
        dueDate = dueDate,
        status = status,
        updatedAt = updatedAt,
    )

    private fun makeVm(): MaintenanceListViewModel =
        MaintenanceListViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(MAINTENANCE_HOME_ID_KEY to "home-1")),
            clock = { fixedNow },
        )

    // ─── Four states ──────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("No maintenance logged yet", (state as ListOfRowsUiState.Empty).headline)
            assertEquals("Log maintenance", state.ctaTitle)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_maps_rows_to_amountWithChip_trailing() =
        runTest {
            coEvery { repo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(
                    GetHomeMaintenanceResponse(
                        tasks =
                            listOf(
                                makeTask(
                                    id = "t1",
                                    task = "Fall HVAC tune-up",
                                    vendor = "Riverside HVAC",
                                    cost = BigDecimal("185"),
                                    dueDate = "2026-05-30T08:00:00Z",
                                    status = "scheduled",
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            state as ListOfRowsUiState.Loaded
            assertFalse(state.hasMore)
            assertEquals(1, state.sections[0].rows.size)
            val row = state.sections[0].rows[0]
            assertEquals("t1", row.id)
            assertEquals("Fall HVAC tune-up", row.title)
            val trailing = row.trailing
            assertTrue(trailing is RowTrailing.AmountWithChip)
            trailing as RowTrailing.AmountWithChip
            assertEquals("$185", trailing.amount)
            assertEquals("Scheduled", trailing.chipText)
            val leading = row.leading
            assertTrue(leading is RowLeading.TypeIcon)
            leading as RowLeading.TypeIcon
            assertEquals(PantopusIcon.Fan, leading.icon)
        }

    // ─── 6-state chip derivation ──────────────────────────────

    @Test fun chip_cancelled_wins() {
        val task = makeTask(status = "cancelled", dueDate = "2026-05-01T00:00:00Z")
        assertEquals(MaintenanceChipStatus.Cancelled, MaintenanceListViewModel.chipStatus(task, fixedNow))
    }

    @Test fun chip_completed_wins() {
        val task = makeTask(status = "completed", dueDate = "2030-01-01T00:00:00Z")
        assertEquals(MaintenanceChipStatus.Completed, MaintenanceListViewModel.chipStatus(task, fixedNow))
    }

    @Test fun chip_inProgress_when_status_set() {
        val task = makeTask(status = "in_progress")
        assertEquals(MaintenanceChipStatus.InProgress, MaintenanceListViewModel.chipStatus(task, fixedNow))
    }

    @Test fun chip_overdue_when_scheduled_and_due_past() {
        val task = makeTask(status = "scheduled", dueDate = "2026-05-01T00:00:00Z")
        assertEquals(MaintenanceChipStatus.Overdue, MaintenanceListViewModel.chipStatus(task, fixedNow))
    }

    @Test fun chip_dueSoon_when_within_seven_days() {
        // 2026-05-21 is 6 days out from fixedNow
        val task = makeTask(status = "scheduled", dueDate = "2026-05-21T00:00:00Z")
        assertEquals(MaintenanceChipStatus.DueSoon, MaintenanceListViewModel.chipStatus(task, fixedNow))
    }

    @Test fun chip_scheduled_when_beyond_seven_days() {
        val task = makeTask(status = "scheduled", dueDate = "2026-05-30T00:00:00Z")
        assertEquals(MaintenanceChipStatus.Scheduled, MaintenanceListViewModel.chipStatus(task, fixedNow))
    }

    // ─── Projection ───────────────────────────────────────────

    @Test fun projection_scheduled_subtitle() {
        val projection =
            MaintenanceListViewModel.project(
                makeTask(
                    task = "Fall HVAC tune-up",
                    vendor = "Riverside HVAC",
                    cost = BigDecimal("185"),
                    recurrence = "yearly",
                    dueDate = "2026-05-30T08:00:00Z",
                    status = "scheduled",
                ),
                fixedNow,
            )
        assertEquals("Scheduled", projection.chipText)
        assertEquals(StatusChipVariant.Info, projection.chipVariant)
        assertEquals("Riverside HVAC · Yearly", projection.subtitle)
        assertEquals("$185", projection.amount)
        assertEquals(MaintenanceCategory.Hvac, projection.category)
    }

    @Test fun projection_diy_zero_cost_renders_as_DIY() {
        val projection =
            MaintenanceListViewModel.project(
                makeTask(
                    task = "Smoke & CO alarm test",
                    vendor = null,
                    cost = BigDecimal.ZERO,
                    recurrence = "quarterly",
                    dueDate = "2026-05-30T08:00:00Z",
                    status = "scheduled",
                ),
                fixedNow,
            )
        assertEquals("DIY", projection.amount)
        assertEquals("Self-managed · Quarterly", projection.subtitle)
        assertEquals(MaintenanceCategory.Safety, projection.category)
    }

    @Test fun projection_overdue_chip_and_inline_chip() {
        val projection =
            MaintenanceListViewModel.project(
                makeTask(status = "scheduled", dueDate = "2026-05-01T00:00:00Z"),
                fixedNow,
            )
        assertEquals("Overdue", projection.chipText)
        assertEquals(StatusChipVariant.ErrorVariant, projection.chipVariant)
        assertEquals(MaintenanceChipStatus.Overdue, projection.status)
        assertEquals("Was due May 1", projection.inlineChip?.text)
    }

    @Test fun projection_completed_success_chip() {
        val projection =
            MaintenanceListViewModel.project(
                makeTask(status = "completed", cost = BigDecimal("240")),
                fixedNow,
            )
        assertEquals("Completed", projection.chipText)
        assertEquals(StatusChipVariant.Success, projection.chipVariant)
        assertEquals("$240", projection.amount)
    }

    // ─── Category inference ───────────────────────────────────

    @Test fun category_hvac_from_title() {
        assertEquals(MaintenanceCategory.Hvac, MaintenanceCategory.from("Fall HVAC tune-up"))
        assertEquals(MaintenanceCategory.Hvac, MaintenanceCategory.from("Replace furnace filter"))
        assertEquals(MaintenanceCategory.Hvac, MaintenanceCategory.from("Air condition service"))
    }

    @Test fun category_plumbing_from_title() {
        assertEquals(MaintenanceCategory.Plumbing, MaintenanceCategory.from("Fix kitchen faucet leak"))
        assertEquals(MaintenanceCategory.Plumbing, MaintenanceCategory.from("Plumber visit"))
        assertEquals(MaintenanceCategory.Plumbing, MaintenanceCategory.from("Service water heater"))
    }

    @Test fun category_electrical_from_title() {
        assertEquals(MaintenanceCategory.Electrical, MaintenanceCategory.from("Electrical panel inspection"))
        assertEquals(MaintenanceCategory.Electrical, MaintenanceCategory.from("Replace bedroom outlet"))
    }

    @Test fun category_gutter_from_title() {
        assertEquals(MaintenanceCategory.Gutter, MaintenanceCategory.from("Gutter clean — front + back"))
        assertEquals(MaintenanceCategory.Gutter, MaintenanceCategory.from("Clear downspout"))
    }

    @Test fun category_chimney_from_title() {
        assertEquals(MaintenanceCategory.Chimney, MaintenanceCategory.from("Chimney sweep + inspection"))
    }

    @Test fun category_pest_from_title() {
        assertEquals(MaintenanceCategory.Pest, MaintenanceCategory.from("Quarterly pest treatment"))
        assertEquals(MaintenanceCategory.Pest, MaintenanceCategory.from("Termite inspection"))
    }

    @Test fun category_safety_from_title() {
        assertEquals(MaintenanceCategory.Safety, MaintenanceCategory.from("Smoke & CO alarm test"))
        assertEquals(MaintenanceCategory.Safety, MaintenanceCategory.from("Fire extinguisher check"))
    }

    @Test fun category_generic_fallback() {
        assertEquals(MaintenanceCategory.Generic, MaintenanceCategory.from(null))
        assertEquals(MaintenanceCategory.Generic, MaintenanceCategory.from(""))
        assertEquals(MaintenanceCategory.Generic, MaintenanceCategory.from("Unrelated chore"))
    }

    // ─── Banner summary ───────────────────────────────────────

    @Test fun banner_summary_counts_overdue_and_ytd_spend() {
        val tasks =
            listOf(
                // Overdue → counts to overdue + scheduled
                makeTask(id = "overdue", task = "Pest", cost = BigDecimal("120"), dueDate = "2026-05-01T00:00:00Z"),
                // Scheduled future → scheduled
                makeTask(id = "soon", task = "HVAC", cost = BigDecimal("185"), dueDate = "2026-05-20T08:00:00Z"),
                // Completed this year → YTD spend
                makeTask(
                    id = "done",
                    task = "Gutter clean",
                    cost = BigDecimal("240"),
                    status = "completed",
                    updatedAt = "2026-02-10T00:00:00Z",
                ),
                // Cancelled → excluded
                makeTask(id = "cancelled", cost = BigDecimal("99"), status = "cancelled"),
            )
        val summary = MaintenanceListViewModel.summarize(tasks, fixedNow)
        assertEquals(1, summary.overdueCount)
        assertEquals("$240", summary.ytdSpendLabel)
        assertTrue(summary.hasContent)
    }

    @Test fun banner_summary_all_clear() {
        val tasks =
            listOf(
                makeTask(id = "future", task = "Replace filters", cost = BigDecimal("25"), dueDate = "2026-06-01T08:00:00Z"),
            )
        val summary = MaintenanceListViewModel.summarize(tasks, fixedNow)
        assertEquals(0, summary.overdueCount)
        assertNull(summary.ytdSpendLabel)
        assertTrue(summary.scheduledSubtitle != null)
    }

    // ─── Tab filtering ────────────────────────────────────────

    @Test fun scheduled_tab_excludes_completed_and_cancelled() =
        runTest {
            coEvery { repo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = mixedTasks()))
            val vm = makeVm()
            vm.load()
            vm.selectTab(MaintenanceTab.Scheduled.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { it.rows }.map { it.id }.toSet()
            assertEquals(setOf("scheduled", "overdue", "in-progress"), ids)
        }

    @Test fun completed_tab_only_completed() =
        runTest {
            coEvery { repo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = mixedTasks()))
            val vm = makeVm()
            vm.load()
            vm.selectTab(MaintenanceTab.Completed.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { it.rows }.map { it.id }
            assertEquals(listOf("completed"), ids)
        }

    @Test fun all_tab_excludes_cancelled() =
        runTest {
            coEvery { repo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(GetHomeMaintenanceResponse(tasks = mixedTasks()))
            val vm = makeVm()
            vm.load()
            vm.selectTab(MaintenanceTab.All.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { it.rows }.map { it.id }.toSet()
            assertEquals(setOf("scheduled", "overdue", "in-progress", "completed"), ids)
            assertFalse("cancelled" in ids)
        }

    // ─── FAB + top-bar ────────────────────────────────────────

    @Test fun fab_is_canonicalCreate_home_tint() {
        val vm = makeVm()
        val fab = vm.fab()
        assertTrue(fab.variant is FabVariant.CanonicalCreate)
        assertEquals(FabTint.Home, fab.tint)
        assertEquals(PantopusIcon.Plus, fab.icon)
    }

    @Test fun topBar_action_null_by_design() {
        val vm = makeVm()
        assertNull(vm.topBarAction)
    }

    private fun mixedTasks(): List<MaintenanceTaskDto> =
        listOf(
            makeTask(id = "scheduled", dueDate = "2026-06-01T00:00:00Z"),
            makeTask(id = "overdue", dueDate = "2026-05-01T00:00:00Z"),
            makeTask(id = "in-progress", status = "in_progress"),
            makeTask(id = "completed", status = "completed"),
            makeTask(id = "cancelled", status = "cancelled"),
        )
}
