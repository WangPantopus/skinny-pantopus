@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.detail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainHelperDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainModesDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainMyReservationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizerDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainSlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.components.SlotCalendarState
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
 * A10.9 (P3.1) — Covers the Android Support Train detail VM. Parity with
 * `SupportTrainDetailViewModelTests.swift`: load() fetches `GET /:id` and
 * projects it; the `resolve` override drives the sample fixtures offline.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SupportTrainDetailViewModelTest {
    private val repo: SupportTrainsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(trainId: String): SupportTrainDetailViewModel {
        val handle = SavedStateHandle(mapOf(SupportTrainDetailViewModel.SUPPORT_TRAIN_ID_KEY to trainId))
        return SupportTrainDetailViewModel(repo, handle)
    }

    private fun slot(
        id: String,
        date: String,
        covered: Boolean,
    ): SupportTrainSlotDto =
        SupportTrainSlotDto(
            id = id,
            slotDate = date,
            slotLabel = "Dinner",
            supportMode = "meal",
            status = if (covered) "full" else "open",
            filledCount = if (covered) 1 else 0,
            capacity = 1,
        )

    @Test
    fun initial_state_is_loading() {
        val vm = makeVm("any")
        assertTrue(vm.state.value is SupportTrainDetailUiState.Loading)
    }

    // MARK: - Live detail fetch + projection

    @Test
    fun load_fetches_detail_and_projects() =
        runTest {
            val dto =
                SupportTrainDetailDto(
                    id = "t1",
                    title = "Meals for the Reyes family",
                    story = "Baby arrived Nov 18 — thank you.",
                    status = "active",
                    supportModes = SupportTrainModesDto(homeCookedMeals = true, takeout = true),
                    recipientSummary = "Household of 4",
                    slots = listOf(slot("s1", "2025-12-02", covered = false), slot("s2", "2025-12-03", covered = true)),
                    myReservations =
                        listOf(
                            SupportTrainMyReservationDto(
                                id = "r1",
                                slotId = "s2",
                                status = "reserved",
                                contributionMode = "cook",
                                dishTitle = "Lentil soup",
                            ),
                        ),
                    organizers =
                        listOf(
                            SupportTrainOrganizerDto(
                                id = "o1",
                                role = "primary",
                                user = SupportTrainHelperDto(id = "u1", username = "diane", name = "Diane K."),
                            ),
                        ),
                )
            coEvery { repo.detail("t1") } returns NetworkResult.Success(dto)

            val vm = makeVm("t1")
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is SupportTrainDetailUiState.Loaded)
            val content = (state as SupportTrainDetailUiState.Loaded).content
            assertEquals("t1", content.trainId)
            assertEquals("Meals for the Reyes family", content.typeDates.title)
            assertEquals(SupportTrainKind.Meals, content.typeDates.kind)
            assertEquals(2, content.typeDates.slotsTotal)
            assertEquals(1, content.typeDates.slotsFilled)
            assertFalse(content.isFullyCovered)
            assertEquals(28, content.calendarDays.size)
            assertEquals("Diane K.", content.hostedBy.organizerDisplayName)
            assertEquals(listOf("mine", "open", "covered"), content.sections.map { it.id })
            assertTrue(content.dock is SupportTrainDock.SignUp)
        }

    @Test
    fun load_fully_covered_produces_celebration() =
        runTest {
            val dto =
                SupportTrainDetailDto(
                    id = "t2",
                    title = "Meals",
                    status = "active",
                    supportModes = SupportTrainModesDto(homeCookedMeals = true),
                    slots = listOf(slot("s1", "2025-12-02", covered = true)),
                )
            coEvery { repo.detail("t2") } returns NetworkResult.Success(dto)

            val vm = makeVm("t2")
            vm.load()
            val content = (vm.state.value as SupportTrainDetailUiState.Loaded).content
            assertTrue(content.isFullyCovered)
            assertNotNull(content.celebrationBanner)
            assertTrue(content.dock is SupportTrainDock.SendCardAndBackup)
        }

    @Test
    fun load_server_error_surfaces_error() =
        runTest {
            coEvery { repo.detail("t3") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm("t3")
            vm.load()
            assertTrue(vm.state.value is SupportTrainDetailUiState.Error)
        }

    // MARK: - Offline resolver

    @Test
    fun resolver_resolves_populated() =
        runTest {
            val vm = makeVm("abc-123")
            vm.resolve = ::defaultResolve
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is SupportTrainDetailUiState.Loaded)
            val content = (state as SupportTrainDetailUiState.Loaded).content
            assertEquals(12, content.typeDates.slotsFilled)
            assertEquals(21, content.typeDates.slotsTotal)
            assertFalse(content.isFullyCovered)
            assertTrue(content.dock is SupportTrainDock.SignUp)
        }

    @Test
    fun resolver_resolves_fully_covered_when_id_contains_covered() =
        runTest {
            val vm = makeVm("fully-covered-xyz")
            vm.resolve = ::defaultResolve
            vm.load()
            val content = (vm.state.value as SupportTrainDetailUiState.Loaded).content
            assertTrue(content.isFullyCovered)
            assertNotNull(content.celebrationBanner)
            assertTrue(content.dock is SupportTrainDock.SendCardAndBackup)
        }

    @Test
    fun load_with_resolver_returning_null_surfaces_error() =
        runTest {
            val vm = makeVm("missing")
            vm.resolve = { null }
            vm.load()
            val state = vm.state.value
            assertTrue(state is SupportTrainDetailUiState.Error)
            assertEquals("Couldn't load this support train.", (state as SupportTrainDetailUiState.Error).message)
        }

    @Test
    fun seed_replaces_state_directly() {
        val vm = makeVm("seeded")
        vm.seed(SupportTrainDetailUiState.Error("Boom"))
        val state = vm.state.value
        assertTrue(state is SupportTrainDetailUiState.Error)
        assertEquals("Boom", (state as SupportTrainDetailUiState.Error).message)
    }

    @Test
    fun refresh_reruns_resolver() =
        runTest {
            var hits = 0
            val vm = makeVm("any")
            vm.resolve = {
                hits += 1
                SupportTrainDetailSampleData.populated
            }
            vm.load()
            vm.refresh()
            assertEquals(2, hits)
            assertTrue(vm.state.value is SupportTrainDetailUiState.Loaded)
        }

    // MARK: - Sample fixtures

    @Test
    fun populated_fixture_matches_frame() {
        val content = SupportTrainDetailSampleData.populated
        assertEquals("The Reyes household", content.recipient.householdName)
        assertEquals(RecipientIdentityTag.Home, content.recipient.identityTag)
        assertTrue(content.recipient.verified)

        assertEquals(SupportTrainKind.Meals, content.typeDates.kind)
        assertEquals(12, content.typeDates.slotsFilled)
        assertEquals(21, content.typeDates.slotsTotal)
        assertEquals(20, content.typeDates.daysLeft)
        assertEquals(57, content.typeDates.percentCovered)

        assertEquals(28, content.calendarDays.size)
        assertEquals(SlotCalendarState.Today, content.calendarDays[8].state)

        val pastCount = content.calendarDays.count { it.state == SlotCalendarState.Past }
        val todayCount = content.calendarDays.count { it.state == SlotCalendarState.Today }
        val openCount = content.calendarDays.count { it.state == SlotCalendarState.Open }
        val filledCount = content.calendarDays.count { it.state == SlotCalendarState.Filled }
        assertEquals(8, pastCount)
        assertEquals(1, todayCount)
        assertEquals(6, filledCount)
        assertEquals(13, openCount)

        assertEquals(2, content.sections.size)
        assertEquals("open", content.sections[0].id)
        assertEquals(3, content.sections[0].rows.size)
        assertEquals("See all 9", content.sections[0].actionLabel)
        assertEquals("covered", content.sections[1].id)
        assertEquals(3, content.sections[1].rows.size)

        assertNull(content.celebrationBanner)
    }

    @Test
    fun fully_covered_fixture_matches_frame() {
        val content = SupportTrainDetailSampleData.fullyCovered
        assertEquals(21, content.typeDates.slotsFilled)
        assertEquals(21, content.typeDates.slotsTotal)
        assertTrue(content.isFullyCovered)
        assertEquals(100, content.typeDates.percentCovered)

        assertEquals(28, content.calendarDays.size)
        assertEquals(SlotCalendarState.Mine, content.calendarDays[10].state)
        val mineCount = content.calendarDays.count { it.state == SlotCalendarState.Mine }
        val openCount = content.calendarDays.count { it.state == SlotCalendarState.Open }
        val pastCount = content.calendarDays.count { it.state == SlotCalendarState.Past }
        assertEquals(1, mineCount)
        assertEquals(0, openCount)
        assertEquals(8, pastCount)

        assertNotNull(content.celebrationBanner)
        assertEquals("Every slot is covered", content.celebrationBanner?.title)

        assertEquals(2, content.sections.size)
        assertEquals("mine", content.sections[0].id)
        assertTrue(content.sections[0].rows.all { it.mine })
        assertEquals("nextup", content.sections[1].id)
        assertEquals("See all 21", content.sections[1].actionLabel)

        assertTrue(content.dock is SupportTrainDock.SendCardAndBackup)
    }

    @Test
    fun type_dates_percent_rounds_half_up() {
        val card =
            TypeDatesCardContent(
                kind = SupportTrainKind.Meals,
                title = "x",
                dateRange = "y",
                daysLeft = 0,
                slotsFilled = 1,
                slotsTotal = 3,
                contributors = emptyList(),
                extraCount = 0,
            )
        assertEquals(33, card.percentCovered)
        assertFalse(card.isFullyCovered)
    }

    @Test
    fun default_resolve_function_routes_correctly() {
        assertEquals(SupportTrainDetailSampleData.populated, defaultResolve("abc"))
        assertEquals(SupportTrainDetailSampleData.fullyCovered, defaultResolve("fully-covered-1"))
        assertEquals(SupportTrainDetailSampleData.fullyCovered, defaultResolve("full-1"))
    }
}
