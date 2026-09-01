@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityScheduleDto
import app.pantopus.android.data.api.models.scheduling.GetAvailabilityResponse
import app.pantopus.android.data.api.models.scheduling.RulesResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
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
class MemberWorkingHoursViewModelTest {
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

    private fun vm(memberId: String) =
        MemberWorkingHoursViewModel(repo, team, auth, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_MEMBER_ID to memberId)))

    @Test
    fun `self edit loads the weekly grid from availability`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns
                NetworkResult.Success(
                    GetAvailabilityResponse(
                        schedules =
                            listOf(
                                AvailabilityScheduleDto(
                                    id = "s1",
                                    name = "Working hours",
                                    timezone = "America/Los_Angeles",
                                    isDefault = true,
                                ),
                            ),
                        rules = listOf(AvailabilityRuleDto(scheduleId = "s1", weekday = 1, startTime = "09:00", endTime = "17:00")),
                    ),
                )
            val vm = vm("biz1")
            vm.load()
            advanceUntilIdle()

            val form = (vm.state.value as MemberWorkingHoursViewModel.UiState.Content).form
            assertFalse(form.isReadOnly)
            assertEquals("My booking hours", form.title)
            assertEquals(7, form.days.size)
            val monday = form.days.first { it.weekday == 1 }
            assertEquals(HoursRange("09:00", "17:00"), monday.ranges.single())
        }

    @Test
    fun `save replaces rules`() =
        runTest(dispatcher) {
            coEvery { repo.getAvailability() } returns
                NetworkResult.Success(
                    GetAvailabilityResponse(
                        schedules = listOf(AvailabilityScheduleDto(id = "s1", timezone = "America/Los_Angeles", isDefault = true)),
                        rules = listOf(AvailabilityRuleDto(scheduleId = "s1", weekday = 1, startTime = "09:00", endTime = "17:00")),
                    ),
                )
            coEvery { repo.setRules(any(), any()) } returns NetworkResult.Success(RulesResponse())
            val vm = vm("biz1")
            vm.load()
            advanceUntilIdle()

            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(MemberWorkingHoursViewModel.Event.Saved, awaitItem())
            }
            coVerify {
                repo.setRules(
                    "s1",
                    match {
                            req ->
                        req.rules.any { it.weekday == 1 && it.startTime == "09:00" && it.endTime == "17:00" }
                    },
                )
            }
        }

    @Test
    fun `teammate row is read-only with their name`() =
        runTest(dispatcher) {
            coEvery { team.members("biz1") } returns
                NetworkResult.Success(
                    BusinessTeamMembersResponse(
                        members = listOf(BusinessTeamMemberDto(id = "m1", user = BusinessTeamUserDto(id = "u2", name = "Marisol"))),
                    ),
                )
            val vm = vm("u2")
            vm.load()
            advanceUntilIdle()

            val form = (vm.state.value as MemberWorkingHoursViewModel.UiState.Content).form
            assertTrue(form.isReadOnly)
            assertEquals("Marisol's booking hours", form.title)
        }
}
