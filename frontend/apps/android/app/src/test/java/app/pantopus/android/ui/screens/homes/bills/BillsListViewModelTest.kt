@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.bills

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
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
import java.math.BigDecimal
import java.time.Instant

/**
 * Covers the Bills VM (T6.0a re-skin of T5.2.2):
 *  - four-state transitions (loading / empty / error / loaded)
 *  - 6-state chip derivation (due / dueSoon / overdue / scheduled /
 *    paid / cancelled)
 *  - per-status projection (chip text + subtitle + inlineChip +
 *    highlight)
 *  - utility-category inference from payee string (one test per
 *    utility)
 *  - banner summary projection (30-day total + overdue count)
 *  - tab filtering across the new chip set
 *  - FAB variant + tint
 *  - topBarAction is `null` by design
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BillsListViewModelTest {
    private val repo: HomesRepository = mockk()

    /** Fixed clock so chip derivation and subtitle formatting are
     *  deterministic — 2026-05-15T12:00:00Z. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeBill(
        id: String = "b",
        status: String = "pending",
        dueDate: String? = "2026-05-25T00:00:00Z",
        paidAt: String? = null,
        provider: String? = null,
        amount: BigDecimal = BigDecimal("10"),
    ) = BillDto(
        id = id,
        homeId = "home-1",
        billType = "x",
        providerName = provider,
        amount = amount,
        dueDate = dueDate,
        status = status,
        paidAt = paidAt,
    )

    private fun makeVm(): BillsListViewModel =
        BillsListViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(BILLS_HOME_ID_KEY to "home-1")),
            clock = { fixedNow },
        )

    // ─── Four states ───────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("No bills tracked yet", (state as ListOfRowsUiState.Empty).headline)
            assertEquals("Add a bill", state.ctaTitle)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_maps_rows_to_amountWithChip_trailing() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(
                    GetHomeBillsResponse(
                        bills =
                            listOf(
                                makeBill(
                                    id = "b1",
                                    provider = "ConEd Electric",
                                    amount = BigDecimal("142.80"),
                                    dueDate = "2026-05-25T00:00:00Z",
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
            assertEquals("b1", row.id)
            assertEquals("ConEd Electric", row.title)
            val trailing = row.trailing
            assertTrue(trailing is RowTrailing.AmountWithChip)
            trailing as RowTrailing.AmountWithChip
            assertEquals("$142.80", trailing.amount)
            assertEquals("Due", trailing.chipText)
            // Leading is TypeIcon with the electric category palette.
            val leading = row.leading
            assertTrue(leading is RowLeading.TypeIcon)
            leading as RowLeading.TypeIcon
            assertEquals(PantopusIcon.Zap, leading.icon)
        }

    // ─── 6-state chip derivation ──────────────────────────────

    @Test fun chipStatus_cancelled_wins() {
        val bill =
            makeBill(
                status = "cancelled",
                dueDate = "2026-05-01T00:00:00Z",
                paidAt = "2026-05-08T00:00:00Z",
            )
        assertEquals(BillChipStatus.Cancelled, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    @Test fun chipStatus_paid_wins() {
        val bill =
            makeBill(
                status = "paid",
                dueDate = "2030-01-01T00:00:00Z",
                paidAt = "2026-05-08T00:00:00Z",
            )
        assertEquals(BillChipStatus.Paid, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    @Test fun chipStatus_scheduled_respects_status_field() {
        val bill = makeBill(status = "scheduled")
        assertEquals(BillChipStatus.Scheduled, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    @Test fun chipStatus_overdue_when_due_past_and_not_paid() {
        val bill = makeBill(dueDate = "2026-05-01T00:00:00Z")
        assertEquals(BillChipStatus.Overdue, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    @Test fun chipStatus_dueSoon_when_due_within_7_days() {
        // fixedNow = 2026-05-15; 6 days out = 2026-05-21 → dueSoon
        val bill = makeBill(dueDate = "2026-05-21T00:00:00Z")
        assertEquals(BillChipStatus.DueSoon, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    @Test fun chipStatus_due_when_beyond_seven_days() {
        // fixedNow = 2026-05-15; 14 days out = 2026-05-29 → due
        val bill = makeBill(dueDate = "2026-05-29T00:00:00Z")
        assertEquals(BillChipStatus.Due, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    @Test fun chipStatus_due_when_no_due_date() {
        val bill = makeBill(dueDate = null)
        assertEquals(BillChipStatus.Due, BillsListViewModel.chipStatus(bill, fixedNow))
    }

    // ─── Per-status projection ────────────────────────────────

    @Test fun projection_paid_subtitle() {
        val projection =
            BillsListViewModel.project(
                makeBill(
                    status = "paid",
                    dueDate = "2026-05-08T00:00:00Z",
                    provider = "Verizon Fios",
                    amount = BigDecimal("89.99"),
                    paidAt = "2026-05-08T00:00:00Z",
                ),
                fixedNow,
            )
        assertEquals("Paid", projection.chipText)
        assertEquals(StatusChipVariant.Success, projection.chipVariant)
        assertEquals("Paid May 8", projection.subtitle)
        assertEquals("$89.99", projection.amount)
        assertNull(projection.inlineChip)
        assertNull(projection.highlight)
    }

    @Test fun projection_cancelled_renders_muted_highlight() {
        val projection =
            BillsListViewModel.project(
                makeBill(status = "cancelled", dueDate = "2026-05-01T00:00:00Z"),
                fixedNow,
            )
        assertEquals("Cancelled", projection.chipText)
        assertEquals(StatusChipVariant.Neutral, projection.chipVariant)
        assertEquals("Cancelled", projection.subtitle)
        assertEquals(RowHighlight.Muted, projection.highlight)
    }

    @Test fun projection_overdue_subtitle() {
        val projection =
            BillsListViewModel.project(
                makeBill(
                    dueDate = "2026-05-05T00:00:00Z",
                    provider = "Elm St HOA",
                    amount = BigDecimal("325.00"),
                ),
                fixedNow,
            )
        assertEquals("Overdue", projection.chipText)
        assertEquals(StatusChipVariant.ErrorVariant, projection.chipVariant)
        assertEquals("Overdue · was due May 5", projection.subtitle)
        assertEquals(UtilityCategory.Hoa, projection.category)
    }

    @Test fun projection_dueSoon_subtitle() {
        val projection =
            BillsListViewModel.project(
                makeBill(
                    dueDate = "2026-05-20T00:00:00Z",
                    provider = "Verizon Fios",
                    amount = BigDecimal("89.99"),
                ),
                fixedNow,
            )
        assertEquals("Due soon", projection.chipText)
        assertEquals(StatusChipVariant.Warning, projection.chipVariant)
        assertEquals("Due May 20", projection.subtitle)
    }

    @Test fun projection_scheduled_attaches_autoPay_inlineChip() {
        val projection =
            BillsListViewModel.project(
                makeBill(
                    status = "scheduled",
                    dueDate = "2026-05-18T00:00:00Z",
                    provider = "Verizon Fios",
                    amount = BigDecimal("89.99"),
                ),
                fixedNow,
            )
        assertEquals("Scheduled", projection.chipText)
        assertEquals(StatusChipVariant.Info, projection.chipVariant)
        assertEquals("Auto-pays May 18", projection.subtitle)
        assertEquals("Auto-pay", projection.inlineChip?.text)
        assertEquals(PantopusIcon.ArrowsRepeat, projection.inlineChip?.icon)
    }

    @Test fun projection_due_subtitle() {
        val projection =
            BillsListViewModel.project(
                makeBill(
                    dueDate = "2026-05-29T00:00:00Z",
                    provider = "National Grid Gas",
                    amount = BigDecimal("67.40"),
                ),
                fixedNow,
            )
        assertEquals("Due", projection.chipText)
        assertEquals(StatusChipVariant.Warning, projection.chipVariant)
        assertEquals("Due May 29", projection.subtitle)
        assertEquals(UtilityCategory.Gas, projection.category)
    }

    // ─── Utility category inference (one test per utility) ────

    @Test fun category_electric() {
        assertEquals(UtilityCategory.Electric, UtilityCategory.from("ConEd Electric"))
        assertEquals(UtilityCategory.Electric, UtilityCategory.from("PG&E"))
        assertEquals(UtilityCategory.Electric, UtilityCategory.from("Duke Energy"))
        assertEquals(UtilityCategory.Electric, UtilityCategory.from("Eversource"))
    }

    @Test fun category_gas() {
        assertEquals(UtilityCategory.Gas, UtilityCategory.from("National Grid Gas"))
        assertEquals(UtilityCategory.Gas, UtilityCategory.from("SoCalGas"))
        assertEquals(UtilityCategory.Gas, UtilityCategory.from("Atmos Energy"))
    }

    @Test fun category_water() {
        assertEquals(UtilityCategory.Water, UtilityCategory.from("NYC Water Board"))
        assertEquals(UtilityCategory.Water, UtilityCategory.from("City Sewer Division"))
        assertEquals(UtilityCategory.Water, UtilityCategory.from("Aqua America"))
    }

    @Test fun category_internet() {
        assertEquals(UtilityCategory.InternetService, UtilityCategory.from("Verizon Fios"))
        assertEquals(UtilityCategory.InternetService, UtilityCategory.from("Comcast Xfinity"))
        assertEquals(UtilityCategory.InternetService, UtilityCategory.from("Spectrum Internet"))
        assertEquals(UtilityCategory.InternetService, UtilityCategory.from("Starlink"))
    }

    @Test fun category_hoa() {
        assertEquals(UtilityCategory.Hoa, UtilityCategory.from("Elm St HOA"))
        assertEquals(UtilityCategory.Hoa, UtilityCategory.from("Sunset Condo Association"))
        assertEquals(UtilityCategory.Hoa, UtilityCategory.from("Birch Strata Corp"))
    }

    @Test fun category_insurance() {
        assertEquals(UtilityCategory.Insurance, UtilityCategory.from("State Farm Renters"))
        assertEquals(UtilityCategory.Insurance, UtilityCategory.from("GEICO Auto"))
        assertEquals(UtilityCategory.Insurance, UtilityCategory.from("Allstate Home Insurance"))
    }

    @Test fun category_trash() {
        assertEquals(UtilityCategory.Trash, UtilityCategory.from("Waste Management"))
        assertEquals(UtilityCategory.Trash, UtilityCategory.from("Recology"))
        assertEquals(UtilityCategory.Trash, UtilityCategory.from("City Refuse Service"))
    }

    @Test fun category_phone() {
        assertEquals(UtilityCategory.Phone, UtilityCategory.from("T-Mobile"))
        assertEquals(UtilityCategory.Phone, UtilityCategory.from("Sprint Wireless"))
        assertEquals(UtilityCategory.Phone, UtilityCategory.from("Mint Mobile"))
    }

    @Test fun category_generic_fallback_for_unknown_payee() {
        assertEquals(UtilityCategory.Generic, UtilityCategory.from(null))
        assertEquals(UtilityCategory.Generic, UtilityCategory.from(""))
        assertEquals(UtilityCategory.Generic, UtilityCategory.from("Some Random Vendor"))
    }

    // ─── Banner summary ───────────────────────────────────────

    @Test fun banner_summary_with_overdue_and_upcoming() {
        val bills =
            listOf(
                // Overdue $325 — counts toward total + overdue
                makeBill(
                    id = "b1",
                    dueDate = "2026-05-05T00:00:00Z",
                    provider = "HOA",
                    amount = BigDecimal("325"),
                ),
                // Due soon $89.99 — counts toward total
                makeBill(
                    id = "b2",
                    dueDate = "2026-05-20T00:00:00Z",
                    provider = "Fios",
                    amount = BigDecimal("89.99"),
                ),
                // Beyond 30 days $48 — excluded from total
                makeBill(
                    id = "b3",
                    dueDate = "2026-07-01T00:00:00Z",
                    provider = "Water",
                    amount = BigDecimal("48"),
                ),
                // Paid $42 — excluded entirely
                makeBill(
                    id = "b4",
                    status = "paid",
                    dueDate = "2026-05-08T00:00:00Z",
                    amount = BigDecimal("42"),
                    paidAt = "2026-05-08T00:00:00Z",
                ),
                // Cancelled $99 — excluded entirely
                makeBill(
                    id = "b5",
                    status = "cancelled",
                    dueDate = "2026-05-08T00:00:00Z",
                    amount = BigDecimal("99"),
                ),
            )
        val summary = BillsListViewModel.summarize(bills, fixedNow)
        // 325 (overdue, within 30d) + 89.99 (due soon, within 30d) = 414.99
        assertEquals("$414.99", summary.totalDueLabel)
        assertEquals(1, summary.overdueCount)
    }

    @Test fun banner_summary_empty_when_all_paid_or_cancelled() {
        val bills =
            listOf(
                makeBill(
                    id = "b1",
                    status = "paid",
                    dueDate = "2026-05-08T00:00:00Z",
                    amount = BigDecimal("42"),
                    paidAt = "2026-05-08T00:00:00Z",
                ),
                makeBill(
                    id = "b2",
                    status = "cancelled",
                    dueDate = "2026-05-08T00:00:00Z",
                    amount = BigDecimal("99"),
                ),
            )
        val summary = BillsListViewModel.summarize(bills, fixedNow)
        assertNull(summary.totalDueLabel)
        assertEquals(0, summary.overdueCount)
        assertFalse(summary.hasContent)
    }

    @Test fun banner_subtitle_shows_next_bill_when_no_overdue() {
        val bills =
            listOf(
                // Due in 6 days — `dueSoon` chip; banner picks it as next-up
                makeBill(
                    id = "b1",
                    dueDate = "2026-05-21T00:00:00Z",
                    provider = "Fios",
                    amount = BigDecimal("89.99"),
                ),
            )
        val summary = BillsListViewModel.summarize(bills, fixedNow)
        assertEquals(0, summary.overdueCount)
        assertNotNull(summary.nextBillSubtitle)
        assertTrue(summary.nextBillSubtitle?.contains("next bill") ?: false)
    }

    // ─── Tab filtering ────────────────────────────────────────

    @Test fun upcoming_tab_includes_due_dueSoon_overdue_scheduled_excludes_paid_cancelled() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = mixedBills()))
            val vm = makeVm()
            vm.load()
            vm.selectTab(BillsTab.Upcoming.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { it.rows }.map { it.id }.toSet()
            assertEquals(setOf("b-due", "b-dueSoon", "b-overdue", "b-scheduled"), ids)
        }

    @Test fun paid_tab_includes_only_paid() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = mixedBills()))
            val vm = makeVm()
            vm.load()
            vm.selectTab(BillsTab.Paid.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { it.rows }.map { it.id }
            assertEquals(listOf("b-paid"), ids)
        }

    @Test fun all_tab_excludes_cancelled() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = mixedBills()))
            val vm = makeVm()
            vm.load()
            vm.selectTab(BillsTab.All.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { it.rows }.map { it.id }.toSet()
            assertEquals(setOf("b-due", "b-dueSoon", "b-overdue", "b-scheduled", "b-paid"), ids)
            assertFalse("b-cancelled" in ids)
        }

    // ─── FAB variant + tint ───────────────────────────────────

    @Test fun fab_is_canonicalCreate_with_home_tint() {
        val vm = makeVm()
        val fab = vm.fab()
        assertTrue(fab.variant is FabVariant.CanonicalCreate)
        assertEquals(FabTint.Home, fab.tint)
        assertEquals(PantopusIcon.Plus, fab.icon)
    }

    @Test fun topBar_action_is_null_by_design() {
        val vm = makeVm()
        assertNull(vm.topBarAction)
    }

    private fun mixedBills(): List<BillDto> =
        listOf(
            makeBill(id = "b-due", dueDate = "2026-05-29T00:00:00Z"),
            makeBill(id = "b-dueSoon", dueDate = "2026-05-21T00:00:00Z"),
            makeBill(id = "b-overdue", dueDate = "2026-05-01T00:00:00Z"),
            makeBill(id = "b-scheduled", status = "scheduled", dueDate = "2026-05-25T00:00:00Z"),
            makeBill(
                id = "b-paid",
                status = "paid",
                dueDate = "2026-05-08T00:00:00Z",
                paidAt = "2026-05-08T00:00:00Z",
            ),
            makeBill(
                id = "b-cancelled",
                status = "cancelled",
                dueDate = "2026-05-08T00:00:00Z",
            ),
        )
}
