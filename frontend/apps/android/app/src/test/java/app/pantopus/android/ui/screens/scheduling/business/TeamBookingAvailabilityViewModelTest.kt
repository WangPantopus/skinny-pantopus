@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.FreeByMemberResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
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
import java.time.LocalDate
import java.time.ZoneOffset

@OptIn(ExperimentalCoroutinesApi::class)
class TeamBookingAvailabilityViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val team: BusinessTeamRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every {
            auth.state
        } returns
            MutableStateFlow(
                AuthRepository.State.SignedIn(UserDto(id = "biz1", email = "b@x.com", displayName = "Biz", avatarUrl = null)),
            )
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = TeamBookingAvailabilityViewModel(repo, team, auth, errors)

    private fun member(
        id: String,
        name: String,
    ) = BusinessTeamMemberDto(id = "m-$id", title = "Stylist", user = BusinessTeamUserDto(id = id, name = name))

    private fun todaySlot(): SlotDto {
        val today = LocalDate.now(ZoneOffset.UTC).toString()
        return SlotDto(start = "${today}T09:00:00Z", startLocal = "${today}T09:00:00")
    }

    @Test
    fun `derives bookability and gating from roster and team-availability`() =
        runTest(dispatcher) {
            coEvery { team.members("biz1") } returns
                NetworkResult.Success(BusinessTeamMembersResponse(members = listOf(member("u1", "Dana"), member("u2", "Marcus"))))
            coEvery { repo.teamAvailability(any(), any(), any(), any()) } returns
                NetworkResult.Success(FreeByMemberResponse(members = listOf("u1"), freeByMember = mapOf("u1" to listOf(todaySlot()))))
            coEvery { team.access("biz1") } returns NetworkResult.Success(BusinessAccessDto(isOwner = true))
            coEvery { repo.getEventTypes(any()) } returns
                NetworkResult.Success(
                    GetEventTypesResponse(
                        eventTypes = listOf(EventTypeDto(id = "e1", name = "Haircut", slug = "haircut", assignmentMode = "round_robin")),
                    ),
                )

            val vm = vm()
            vm.load()
            advanceUntilIdle()

            val content = vm.state.value as TeamBookingAvailabilityViewModel.UiState.Content
            assertEquals(2, content.rows.size)
            val dana = content.rows.first { it.id == "u1" }
            val marcus = content.rows.first { it.id == "u2" }
            assertTrue(dana.bookable)
            assertFalse(marcus.bookable)
            assertEquals("Not taking bookings", marcus.summary)
            assertFalse(content.gated)
            assertEquals(1, content.assignable.size)
            assertFalse(content.assignable.first().collective)
        }

    @Test
    fun `gates when caller lacks team_manage`() =
        runTest(dispatcher) {
            coEvery {
                team.members(
                    "biz1",
                )
            } returns NetworkResult.Success(BusinessTeamMembersResponse(members = listOf(member("u1", "Dana"))))
            coEvery { repo.teamAvailability(any(), any(), any(), any()) } returns NetworkResult.Success(FreeByMemberResponse())
            coEvery { team.access("biz1") } returns NetworkResult.Success(BusinessAccessDto(isOwner = false, permissions = emptyList()))
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse())

            val vm = vm()
            vm.load()
            advanceUntilIdle()

            assertTrue((vm.state.value as TeamBookingAvailabilityViewModel.UiState.Content).gated)
        }

    @Test
    fun `roster failure surfaces an error state`() =
        runTest(dispatcher) {
            coEvery { team.members("biz1") } returns NetworkResult.Failure(NetworkError.Server(500, null))

            val vm = vm()
            vm.load()
            advanceUntilIdle()

            assertTrue(vm.state.value is TeamBookingAvailabilityViewModel.UiState.Error)
        }
}
