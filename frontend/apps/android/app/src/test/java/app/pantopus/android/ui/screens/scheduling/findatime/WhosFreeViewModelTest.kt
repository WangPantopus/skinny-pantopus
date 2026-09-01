@file:Suppress("PackageNaming", "MagicNumber", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.findatime

import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.scheduling.FreeByMemberResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
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
class WhosFreeViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val homes: HomesRepository = mockk()
    private val members: HomeMembersRepository = mockk()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val session = FindATimeSession()
    private val networkMonitor: NetworkMonitor = mockk()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { networkMonitor.isOnline } returns MutableStateFlow(true)
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = listOf(home("home-1")), message = null))
        coEvery { members.listOccupants("home-1") } returns
            NetworkResult.Success(
                OccupantsResponse(
                    occupants =
                        listOf(
                            occupant("u-mom", "Mom"),
                            occupant("u-dad", "Dad"),
                            occupant("u-ava", "Ava"),
                            occupant("u-tomek", "Tomek"),
                        ),
                ),
            )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = WhosFreeViewModel(homes, members, repo, session, networkMonitor)

    /** A free block whose local start hour lands in a grid bucket. */
    private fun freeBlock(localHour: Int) =
        SlotDto(
            start = "2026-06-17T${"%02d".format(localHour)}:00:00Z",
            end = "2026-06-17T${"%02d".format(localHour + 1)}:00:00Z",
            startLocal = "2026-06-17T${"%02d".format(localHour)}:00:00",
        )

    @Test
    fun loaded_grid_marks_free_and_optedout() =
        runTest(dispatcher) {
            coEvery { repo.whosFree(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    FreeByMemberResponse(
                        members = listOf("u-mom", "u-dad", "u-ava"),
                        freeByMember = mapOf("u-mom" to listOf(freeBlock(9)), "u-dad" to listOf(freeBlock(13))),
                    ),
                )
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as WhosFreeUiState.Loaded
            assertEquals(4, loaded.grid.rows.size)
            assertEquals(6, loaded.grid.columns.size)
            assertTrue(loaded.hasFree)
            // Mom is free in the first (8–10a) bucket.
            assertEquals(CellState.Free, loaded.grid.rows.first { it.member.userId == "u-mom" }.cells[0])
            // Tomek hasn't shared availability → Unknown row + opted-out.
            assertTrue(loaded.grid.rows.first { it.member.userId == "u-tomek" }.cells.all { it == CellState.Unknown })
            assertTrue(loaded.optedOutNames.contains("Tomek"))
            assertFalse(loaded.emptyAllBusy)
        }

    @Test
    fun everyone_busy_flags_empty() =
        runTest(dispatcher) {
            // Mom and Dad share availability but their only free blocks fall outside
            // the 8a–6p grid buckets → all Busy cells; no member is Free.
            coEvery { repo.whosFree(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    FreeByMemberResponse(
                        members = listOf("u-mom", "u-dad"),
                        freeByMember = mapOf("u-mom" to listOf(freeBlock(6)), "u-dad" to listOf(freeBlock(6))),
                    ),
                )
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as WhosFreeUiState.Loaded
            assertFalse(loaded.hasFree)
            assertTrue(loaded.emptyAllBusy)
        }

    @Test
    fun empty_free_list_reads_as_not_shared() =
        runTest(dispatcher) {
            // The backend lists every active occupant in `members`, so an empty
            // free-list (not absence from `members`) is the opted-out signal.
            coEvery { repo.whosFree(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    FreeByMemberResponse(
                        members = listOf("u-mom", "u-dad", "u-ava", "u-tomek"),
                        freeByMember = mapOf("u-mom" to listOf(freeBlock(9)), "u-dad" to emptyList()),
                    ),
                )
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as WhosFreeUiState.Loaded
            assertTrue(loaded.grid.rows.first { it.member.userId == "u-dad" }.cells.all { it == CellState.Unknown })
            assertTrue(loaded.optedOutNames.containsAll(listOf("Dad", "Ava", "Tomek")))
            assertFalse(loaded.optedOutNames.contains("Mom"))
        }

    @Test
    fun select_filter_limits_visible_rows() =
        runTest(dispatcher) {
            coEvery { repo.whosFree(any(), any(), any(), any()) } returns
                NetworkResult.Success(FreeByMemberResponse(members = listOf("u-mom"), freeByMember = mapOf("u-mom" to listOf(freeBlock(9)))))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.selectFilter("u-mom")
            val loaded = vm.state.value as WhosFreeUiState.Loaded
            assertEquals(1, loaded.visibleRows.size)
            assertEquals("u-mom", loaded.visibleRows.first().member.userId)
        }

    @Test
    fun whosfree_failure_surfaces_error() =
        runTest(dispatcher) {
            coEvery { repo.whosFree(any(), any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is WhosFreeUiState.Error)
        }

    @Test
    fun find_a_time_here_seeds_session() =
        runTest(dispatcher) {
            coEvery { repo.whosFree(any(), any(), any(), any()) } returns
                NetworkResult.Success(FreeByMemberResponse(members = listOf("u-mom"), freeByMember = mapOf("u-mom" to listOf(freeBlock(9)))))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.seedFindATime()
            assertTrue(session.seedFromIso != null)
            assertTrue(session.seedToIso != null)
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
