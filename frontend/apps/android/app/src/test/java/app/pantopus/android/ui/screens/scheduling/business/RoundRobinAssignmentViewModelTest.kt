@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import app.cash.turbine.test
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto
import app.pantopus.android.data.api.models.scheduling.AssigneesResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeAssigneeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
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
class RoundRobinAssignmentViewModelTest {
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

    private fun vm() = RoundRobinAssignmentViewModel(repo, team, auth, errors)

    private fun member(
        id: String,
        name: String,
    ) = BusinessTeamMemberDto(id = "m-$id", title = "Stylist", user = BusinessTeamUserDto(id = id, name = name))

    private fun seed(assignees: List<EventTypeAssigneeDto>) {
        coEvery { repo.getEventType(any(), "e1") } returns
            NetworkResult.Success(
                EventTypeDetailResponse(
                    eventType = EventTypeDto(id = "e1", name = "Haircut", slug = "haircut", assignmentMode = "round_robin"),
                    assignees = assignees,
                ),
            )
        coEvery { team.members("biz1") } returns
            NetworkResult.Success(
                BusinessTeamMembersResponse(members = listOf(member("u1", "Dana"), member("u2", "Marcus"), member("u3", "Priya"))),
            )
    }

    @Test
    fun `infers balanced rule and seeds weights from assignees`() =
        runTest(dispatcher) {
            seed(listOf(EventTypeAssigneeDto(subjectId = "u1", weight = 2), EventTypeAssigneeDto(subjectId = "u2", weight = 1)))
            val vm = vm()
            vm.start("e1")
            advanceUntilIdle()

            val content = vm.state.value as RoundRobinAssignmentViewModel.UiState.Content
            assertEquals(RoundRobinAssignmentViewModel.Rule.Balanced, content.rule)
            assertEquals(2, content.picks.first { it.id == "u1" }.weight)
            assertTrue(content.picks.first { it.id == "u1" }.checked)
            assertFalse(content.picks.first { it.id == "u3" }.checked)
        }

    @Test
    fun `balanced save sends weight per member`() =
        runTest(dispatcher) {
            seed(listOf(EventTypeAssigneeDto(subjectId = "u1", weight = 2)))
            coEvery { repo.setAssignees(any(), any(), any()) } returns NetworkResult.Success(AssigneesResponse())
            val vm = vm()
            vm.start("e1")
            advanceUntilIdle()

            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(RoundRobinAssignmentViewModel.Event.Saved, awaitItem())
            }
            coVerify {
                repo.setAssignees(
                    any(),
                    "e1",
                    // Balanced writes the negative sentinel so a reload can tell it apart from
                    // Strict — previously "balanced with default weights" round-tripped as
                    // Strict and silently changed the host rotation.
                    match { req ->
                        req.assignees.any {
                            it.subjectId == "u1" &&
                                it.weight == 2 &&
                                it.priority == RoundRobinAssignmentViewModel.BALANCED_PRIORITY_SENTINEL
                        }
                    },
                )
            }
        }

    @Test
    fun `priority save sends positional priority`() =
        runTest(dispatcher) {
            seed(listOf(EventTypeAssigneeDto(subjectId = "u1"), EventTypeAssigneeDto(subjectId = "u2")))
            coEvery { repo.setAssignees(any(), any(), any()) } returns NetworkResult.Success(AssigneesResponse())
            val vm = vm()
            vm.start("e1")
            advanceUntilIdle()
            vm.selectRule(RoundRobinAssignmentViewModel.Rule.Priority)

            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(RoundRobinAssignmentViewModel.Event.Saved, awaitItem())
            }
            coVerify {
                repo.setAssignees(
                    any(),
                    "e1",
                    // Priority ranks are 1-based: >0 is what marks the rule on reload
                    // (0 stays reserved for Strict's neutral shape).
                    match { req ->
                        req.assignees.all { it.weight == 1 } && req.assignees.map { it.priority }.toSet() == setOf(1, 2)
                    },
                )
            }
        }
}
