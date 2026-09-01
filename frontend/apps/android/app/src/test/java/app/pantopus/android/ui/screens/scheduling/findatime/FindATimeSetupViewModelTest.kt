@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.findatime

import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FindATimeSetupViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val homes: HomesRepository = mockk()
    private val members: HomeMembersRepository = mockk()
    private val session = FindATimeSession()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = listOf(home("home-1")), message = null))
        coEvery { members.listOccupants("home-1") } returns
            NetworkResult.Success(
                OccupantsResponse(
                    occupants =
                        listOf(
                            occupant("u-mom", "Mom"),
                            occupant("u-dad", "Dad"),
                            occupant("u-ava", "Ava"),
                        ),
                ),
            )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = FindATimeSetupViewModel(homes, members, session)

    @Test
    fun load_resolves_home_and_roster_all_required() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as FindATimeSetupUiState.Loaded
            assertEquals(3, loaded.form.members.size)
            assertTrue(loaded.form.members.all { it.required })
            assertTrue(loaded.form.canNext)
        }

    @Test
    fun no_home_surfaces_error() =
        runTest(dispatcher) {
            coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = emptyList(), message = null))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is FindATimeSetupUiState.Error)
        }

    @Test
    fun roster_failure_surfaces_error() =
        runTest(dispatcher) {
            coEvery { members.listOccupants("home-1") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is FindATimeSetupUiState.Error)
        }

    @Test
    fun all_optional_blocks_next() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            listOf("u-mom", "u-dad", "u-ava").forEach { vm.toggleRequired(it, required = false) }
            val loaded = vm.state.value as FindATimeSetupUiState.Loaded
            assertFalse(loaded.form.hasRequired)
            assertFalse(loaded.form.canNext)
            assertFalse(vm.submit())
        }

    @Test
    fun submit_stashes_criteria_for_f5() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.setMode(FindMode.RoundRobin)
            assertTrue(vm.submit())
            assertNotNull(session.criteria)
            val criteria = session.criteria!!
            assertEquals("home-1", criteria.homeId)
            assertEquals("Plan a family call", criteria.title) // blank title → placeholder
            assertEquals(FindMode.RoundRobin, criteria.mode)
            assertEquals(3, criteria.requiredMembers.size)
            assertTrue(criteria.fromIso <= criteria.toIso)
        }

    @Test
    fun makeSomeoneOptional_drops_last_required() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.makeSomeoneOptional()
            val loaded = vm.state.value as FindATimeSetupUiState.Loaded
            assertFalse(loaded.form.members.last().required)
            assertEquals(2, loaded.form.members.count { it.required })
        }

    @Test
    fun widenWindow_extends_range() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.widenWindow()
            val loaded = vm.state.value as FindATimeSetupUiState.Loaded
            assertEquals(WindowPreset.TwoWeeks, loaded.form.windowPreset)
            val (from, to) = loaded.form.range
            assertEquals(13L, java.time.temporal.ChronoUnit.DAYS.between(from, to))
        }

    @Test
    fun f7_seed_anchors_the_window_and_is_consumed() =
        runTest(dispatcher) {
            session.seedFromIso = "2026-06-20"
            session.seedToIso = "2026-06-26" // 6-day span → ThisWeek preset
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val form = (vm.state.value as FindATimeSetupUiState.Loaded).form
            assertEquals(java.time.LocalDate.of(2026, 6, 20), form.today)
            assertEquals(WindowPreset.ThisWeek, form.windowPreset)
            assertEquals(null, session.seedFromIso) // consumed
            assertEquals(null, session.seedToIso)
        }

    @Test
    fun submit_sends_an_exclusive_end_date() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.submit())
            val form = (vm.state.value as FindATimeSetupUiState.Loaded).form
            val (from, to) = form.range
            val criteria = session.criteria!!
            assertEquals(FindATimeFormat.isoDate(from), criteria.fromIso)
            assertEquals(FindATimeFormat.isoDate(to.plusDays(1)), criteria.toIso)
        }

    @Test
    fun f5_no_overlap_note_applies_on_reentry_and_clears_on_mutation() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            session.noOverlapMessage = "Try making Mom optional, or widen the date window."
            vm.start() // re-entry (e.g. reopened as F5's edit sheet)
            var form = (vm.state.value as FindATimeSetupUiState.Loaded).form
            assertEquals("Try making Mom optional, or widen the date window.", form.noOverlapMessage)
            assertEquals(null, session.noOverlapMessage) // consumed
            vm.widenWindow()
            form = (vm.state.value as FindATimeSetupUiState.Loaded).form
            assertEquals(null, form.noOverlapMessage)
        }

    private fun occupant(
        userId: String,
        name: String,
    ) = OccupantDto(id = "occ-$userId", userId = userId, displayName = name, isActive = true)

    private fun home(id: String) =
        MyHome(
            id = id, name = "Birch Ln", address = null, city = null, state = null, zipcode = null,
            homeType = null, visibility = null, description = null, createdAt = null, updatedAt = null,
            occupancy = null, ownershipStatus = null, verificationTier = null, isPrimaryOwner = null,
            pendingClaimId = null,
        )
}
