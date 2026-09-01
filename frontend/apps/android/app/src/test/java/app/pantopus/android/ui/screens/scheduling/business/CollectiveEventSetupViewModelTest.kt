@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto
import app.pantopus.android.data.api.models.scheduling.AssigneesResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeAssigneeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingErrorEnvelope
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CollectiveEventSetupViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val team: BusinessTeamRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val moshi = Moshi.Builder().build()

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

    private fun vm() =
        CollectiveEventSetupViewModel(repo, team, auth, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_EVENT_TYPE_ID to "e1")))

    private fun member(
        id: String,
        name: String,
    ) = BusinessTeamMemberDto(id = "m-$id", title = "Stylist", user = BusinessTeamUserDto(id = id, name = name))

    private fun seedPool(
        mode: String,
        seatCap: Int,
    ) {
        coEvery { repo.getEventType(any(), "e1") } returns
            NetworkResult.Success(
                EventTypeDetailResponse(
                    eventType = EventTypeDto(id = "e1", name = "Group class", slug = "group", assignmentMode = mode, seatCap = seatCap),
                    assignees = listOf(EventTypeAssigneeDto(subjectId = "u1", subjectType = "user")),
                ),
            )
        coEvery { team.members("biz1") } returns
            NetworkResult.Success(BusinessTeamMembersResponse(members = listOf(member("u1", "Tara"), member("u2", "Sam"))))
    }

    @Test
    fun `loads collective state with assigned members checked`() =
        runTest(dispatcher) {
            seedPool(mode = "collective", seatCap = 3)
            val vm = vm()
            vm.load()
            advanceUntilIdle()

            val content = vm.state.value as CollectiveEventSetupViewModel.UiState.Content
            assertTrue(content.requireMultiple)
            assertEquals(3, content.seatsPerAppointment)
            assertTrue(content.picks.first { it.id == "u1" }.checked)
            assertEquals(1, content.checkedCount)
        }

    @Test
    fun `save writes collective mode plus seat cap and assignees`() =
        runTest(dispatcher) {
            seedPool(mode = "collective", seatCap = 1)
            coEvery { repo.updateEventType(any(), any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e1", name = "Group class", slug = "group")))
            coEvery { repo.setAssignees(any(), any(), any()) } returns NetworkResult.Success(AssigneesResponse())

            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggle("u2")

            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(CollectiveEventSetupViewModel.Event.Saved, awaitItem())
            }
            coVerify { repo.updateEventType(any(), "e1", match { it.assignmentMode == "collective" && it.seatCap == 1 }) }
            coVerify { repo.setAssignees(any(), "e1", match { req -> req.assignees.map { it.subjectId }.containsAll(listOf("u1", "u2")) }) }
        }

    @Test
    fun `invalid assignee surfaces a toast`() =
        runTest(dispatcher) {
            seedPool(mode = "collective", seatCap = 1)
            coEvery { repo.updateEventType(any(), any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e1", name = "Group class", slug = "group")))
            val body = moshi.adapter(SchedulingErrorEnvelope::class.java).toJson(SchedulingErrorEnvelope(error = "INVALID_ASSIGNEE"))
            coEvery { repo.setAssignees(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.ClientError(400, body))

            val vm = vm()
            vm.load()
            advanceUntilIdle()

            vm.events.test {
                vm.save()
                advanceUntilIdle()
                val event = awaitItem()
                assertTrue(event is CollectiveEventSetupViewModel.Event.Toast)
                assertTrue((event as CollectiveEventSetupViewModel.Event.Toast).message.contains("team"))
            }
        }
}
