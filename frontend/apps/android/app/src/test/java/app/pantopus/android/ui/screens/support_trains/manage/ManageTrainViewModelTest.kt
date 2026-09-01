@file:Suppress("LongMethod", "PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.manage

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainFundDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizersResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationsResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainSlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainsRepository
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

/**
 * P4.3 / A13.13 — Manage train ViewModel. Parity with the iOS
 * `ManageTrainViewModelTests`: `load()` projects the seeded fixture or the
 * live `GET /:id` payload; draft mutations stay in-memory; `sendUpdate` /
 * `confirmClose` optimistically mutate local state and fire
 * `POST /:id/updates` / `POST /:id/complete`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ManageTrainViewModelTest {
    private val repo: SupportTrainsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { repo.postUpdate(any(), any()) } returns NetworkResult.Success(Unit)
        coEvery { repo.complete(any()) } returns NetworkResult.Success(Unit)
        // S1 — `load()` now fans out to the organizer-only feeds as well.
        coEvery { repo.reservations(any()) } returns NetworkResult.Success(SupportTrainReservationsResponse())
        coEvery { repo.organizers(any()) } returns NetworkResult.Success(SupportTrainOrganizersResponse())
        coEvery { repo.fund(any()) } returns NetworkResult.Success(SupportTrainFundDto())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun savedState(trainId: String = ManageTrainSampleData.TRAIN_ID): SavedStateHandle =
        SavedStateHandle(mapOf(ManageTrainViewModel.TRAIN_ID_KEY to trainId))

    /** Offline VM seeded with the design fixture (no `load()` network). */
    private fun makeVm(): ManageTrainViewModel = ManageTrainViewModel(repo, savedState()).also { it.load(ManageTrainSampleData.active) }

    private fun slot(
        id: String,
        date: String,
        covered: Boolean,
    ): SupportTrainSlotDto =
        SupportTrainSlotDto(
            id = id,
            slotDate = date,
            slotLabel = "Dinner",
            status = if (covered) "full" else "open",
            filledCount = if (covered) 1 else 0,
            capacity = 1,
        )

    @Test
    fun load_projects_active_fixture() =
        runTest {
            val vm = makeVm()
            val state = vm.state.value
            val loaded = state.state as ManageTrainState.Loaded
            assertEquals("Meals for the Murphy family", loaded.content.title)
            assertTrue(loaded.content.isActive)
            assertEquals("18/21", loaded.content.slotFillValue)
            assertEquals("12", loaded.content.helpersValue)
            assertEquals("9d", loaded.content.daysLeftValue)
            assertEquals("1", loaded.content.dropoutValue)
            assertEquals(
                listOf("edit-dates", "invite", "analytics"),
                loaded.content.organizeRows.map { it.id },
            )
            assertEquals("close", loaded.content.closeRow.id)
            assertTrue(loaded.content.closeRow.isDestructive)
        }

    @Test
    fun initial_draft_mirrors_content() =
        runTest {
            val vm = makeVm()
            val state = vm.state.value
            assertFalse("Active fixture seeds a typed draft", state.draftMessage.isEmpty())
            assertEquals("all", state.selectedAudienceId)
            assertTrue(state.pushToPhones)
            assertTrue(state.canSendUpdate)
        }

    @Test
    fun character_cap_clamps_oversize_input() =
        runTest {
            val vm = makeVm()
            val oversized = "x".repeat(ManageTrainUiState.MAX_MESSAGE_CHARS + 50)
            vm.updateDraftMessage(oversized)
            assertEquals(ManageTrainUiState.MAX_MESSAGE_CHARS, vm.state.value.draftMessage.length)
            assertEquals(ManageTrainUiState.MAX_MESSAGE_CHARS, vm.state.value.characterCount)
        }

    @Test
    fun empty_draft_disables_send() =
        runTest {
            val vm = makeVm()
            vm.updateDraftMessage("   \n  ")
            assertFalse(
                "Whitespace-only draft is not sendable",
                vm.state.value.canSendUpdate,
            )
        }

    @Test
    fun select_audience_updates_selection() =
        runTest {
            val vm = makeVm()
            vm.selectAudience("upcoming")
            assertEquals("upcoming", vm.state.value.selectedAudienceId)
        }

    @Test
    fun select_audience_rejects_unknown_id() =
        runTest {
            val vm = makeVm()
            vm.selectAudience("does-not-exist")
            assertEquals(
                "Unknown ids are dropped",
                "all",
                vm.state.value.selectedAudienceId,
            )
        }

    @Test
    fun send_update_clears_draft_and_flashes_toast() =
        runTest {
            val vm = makeVm()
            assertNull(vm.state.value.toast)
            vm.sendUpdate()
            assertEquals("", vm.state.value.draftMessage)
            assertNotNull(vm.state.value.toast)
            assertTrue(vm.state.value.toast!!.contains("12"))
        }

    @Test
    fun show_and_hide_close_sheet() =
        runTest {
            val vm = makeVm()
            assertEquals(ManageTrainSheetMode.HIDDEN, vm.state.value.sheetMode)
            vm.showCloseSheet()
            assertEquals(ManageTrainSheetMode.CLOSING, vm.state.value.sheetMode)
            vm.hideCloseSheet()
            assertEquals(ManageTrainSheetMode.HIDDEN, vm.state.value.sheetMode)
        }

    @Test
    fun confirm_close_flips_train_and_fires_toast() =
        runTest {
            val vm = makeVm()
            vm.showCloseSheet()
            vm.confirmClose()
            assertEquals(ManageTrainSheetMode.CLOSED, vm.state.value.sheetMode)
            val loaded = vm.state.value.state as ManageTrainState.Loaded
            assertFalse(
                "Confirm close flips the train chip to Closed",
                loaded.content.isActive,
            )
            assertNotNull(vm.state.value.toast)
        }

    @Test
    fun load_fetches_detail_and_derives_stats() =
        runTest {
            val dto =
                SupportTrainDetailDto(
                    id = "t9",
                    title = "Meals for the Reyes family",
                    status = "active",
                    slots =
                        listOf(
                            slot("s1", "2025-12-01", covered = true),
                            slot("s2", "2025-12-02", covered = true),
                            slot("s3", "2025-12-03", covered = false),
                            slot("s4", "2025-12-04", covered = false),
                        ),
                )
            coEvery { repo.detail("t9") } returns NetworkResult.Success(dto)
            val vm = ManageTrainViewModel(repo, savedState("t9"))
            vm.load()
            val loaded = vm.state.value.state as ManageTrainState.Loaded
            assertEquals("Meals for the Reyes family", loaded.content.title)
            assertTrue(loaded.content.isActive)
            assertEquals(4, loaded.content.slotsTotal)
            assertEquals(2, loaded.content.slotsFilled)
            assertEquals(2, loaded.content.slotsOpen)
            assertEquals("2/4", loaded.content.slotFillValue)
            assertEquals(
                listOf("edit-dates", "invite", "analytics"),
                loaded.content.organizeRows.map { it.id },
            )
        }

    @Test
    fun load_server_error_surfaces_error() =
        runTest {
            coEvery { repo.detail("t9") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = ManageTrainViewModel(repo, savedState("t9"))
            vm.load()
            assertTrue(vm.state.value.state is ManageTrainState.Error)
        }

    @Test
    fun sample_data_active_fixture_matches_design_copy() {
        val content = ManageTrainSampleData.active
        assertEquals("18", content.close.mealsDelivered)
        assertEquals("12", content.close.neighborsHelped)
        assertEquals("12d", content.close.coverageDays)
        assertTrue(content.close.recipientQuote.contains("Theo"))
        assertEquals("All helpers", content.audienceChips.first().label)
        assertEquals("12", content.audienceChips.first().count)
    }
}
