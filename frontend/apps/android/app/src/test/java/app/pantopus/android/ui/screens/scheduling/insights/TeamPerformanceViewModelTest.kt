@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto
import app.pantopus.android.data.api.models.scheduling.HostPerformance
import app.pantopus.android.data.api.models.scheduling.TeamPerformanceResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TeamPerformanceViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val team: BusinessTeamRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val relay = InsightsNavRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = TeamPerformanceViewModel(repo, team, errors, relay)

    private fun members() =
        NetworkResult.Success(
            BusinessTeamMembersResponse(
                listOf(
                    BusinessTeamMemberDto(id = "m1", user = BusinessTeamUserDto(id = "u1", name = "Ana")),
                    BusinessTeamMemberDto(id = "m2", user = BusinessTeamUserDto(id = "u2", name = "Bo")),
                ),
            ),
        )

    private fun hosts() =
        NetworkResult.Success(
            TeamPerformanceResponse(
                windowDays = 90,
                hosts =
                    listOf(
                        HostPerformance(hostUserId = "u1", total = 6, completed = 5, noShow = 1),
                        HostPerformance(hostUserId = "u2", total = 4, completed = 1, noShow = 3),
                    ),
            ),
        )

    @Test
    fun `personal owner gates to business-only without calling the endpoint`() =
        runTest(dispatcher) {
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is TeamUiState.BusinessOnly)
        }

    @Test
    fun `business owner loads ranked members and re-sorts`() =
        runTest(dispatcher) {
            relay.pendingOwner = SchedulingOwner.Business("biz")
            coEvery { repo.getTeamInsights(any(), any()) } returns hosts()
            coEvery { team.members(any()) } returns members()
            val model = vm()
            model.start()
            advanceUntilIdle()

            val loaded = model.state.value as TeamUiState.Loaded
            assertEquals("Ana", loaded.data.rows.first().name)
            assertEquals(2, loaded.data.rows.size)

            model.toggleSort()
            val resorted = model.state.value as TeamUiState.Loaded
            assertEquals("Bo", resorted.data.rows.first().name) // highest no-show rate first
        }

    @Test
    fun `403 maps to permission gated`() =
        runTest(dispatcher) {
            relay.pendingOwner = SchedulingOwner.Business("biz")
            coEvery { repo.getTeamInsights(any(), any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is TeamUiState.PermissionGated)
        }

    @Test
    fun `empty hosts yields empty state`() =
        runTest(dispatcher) {
            relay.pendingOwner = SchedulingOwner.Business("biz")
            coEvery { repo.getTeamInsights(any(), any()) } returns
                NetworkResult.Success(TeamPerformanceResponse(windowDays = 90, hosts = emptyList()))
            coEvery { team.members(any()) } returns members()
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is TeamUiState.Empty)
        }
}
