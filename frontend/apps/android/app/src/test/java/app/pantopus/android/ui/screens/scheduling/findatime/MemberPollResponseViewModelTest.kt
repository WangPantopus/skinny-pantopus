@file:Suppress("PackageNaming", "MagicNumber", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.PollDetailResponse
import app.pantopus.android.data.api.models.scheduling.PollDto
import app.pantopus.android.data.api.models.scheduling.PollOptionDto
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
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

@OptIn(ExperimentalCoroutinesApi::class)
class MemberPollResponseViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val auth: AuthRepository = mockk()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns
            MutableStateFlow(
                AuthRepository.State.SignedIn(UserDto(id = "u-1", email = "mom@home.test", displayName = "Mom", avatarUrl = null)),
            )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = MemberPollResponseViewModel(repo, errors, auth, SavedStateHandle(mapOf(SchedulingRoutes.ARG_POLL_ID to "poll-1")))

    private fun openPoll() =
        PollDetailResponse(
            poll = PollDto(id = "poll-1", title = "Family call", durationMin = 30, status = "open"),
            options =
                listOf(
                    PollOptionDto(id = "opt-a", startAt = "2026-06-22T21:00:00Z", endAt = "2026-06-22T21:30:00Z"),
                    PollOptionDto(id = "opt-b", startAt = "2026-06-23T01:00:00Z", endAt = "2026-06-23T01:30:00Z"),
                ),
            votes = emptyList(),
        )

    @Test
    fun open_poll_loads_options() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPoll("poll-1") } returns NetworkResult.Success(openPoll())
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as PollResponseUiState.Loaded
            assertEquals(2, loaded.options.size)
            assertFalse(loaded.needsEmail) // signed-in email present
            assertFalse(loaded.canSubmit) // nothing voted yet
        }

    @Test
    fun closed_poll_is_read_only() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPoll("poll-1") } returns
                NetworkResult.Success(
                    openPoll().copy(poll = PollDto(id = "poll-1", title = "Family call", status = "closed", finalizedStartAt = "2026-06-22T21:00:00Z")),
                )
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val closed = vm.state.value as PollResponseUiState.Closed
            assertTrue(closed.finalizedLabel != null)
            assertEquals(2, closed.options.size)
        }

    @Test
    fun vote_then_submit_marks_submitted() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPoll("poll-1") } returns NetworkResult.Success(openPoll())
            coEvery { repo.publicVotePoll(any(), any()) } returns NetworkResult.Success(SchedulingOkResponse())
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.setVote("opt-a", VoteValue.Works)
            assertTrue((vm.state.value as PollResponseUiState.Loaded).canSubmit)
            vm.submit()
            advanceUntilIdle()
            assertTrue((vm.state.value as PollResponseUiState.Loaded).submitted)
        }

    @Test
    fun toggle_same_vote_clears_it() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPoll("poll-1") } returns NetworkResult.Success(openPoll())
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.setVote("opt-a", VoteValue.Maybe)
            vm.setVote("opt-a", VoteValue.Maybe)
            val loaded = vm.state.value as PollResponseUiState.Loaded
            assertEquals(null, loaded.options.first { it.id == "opt-a" }.vote)
        }

    @Test
    fun vote_on_closed_poll_transitions_to_closed() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPoll("poll-1") } returns NetworkResult.Success(openPoll())
            coEvery { repo.publicVotePoll(any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(409, """{"error":"POLL_CLOSED"}"""))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.setVote("opt-a", VoteValue.Works)
            vm.submit()
            advanceUntilIdle()
            assertTrue(vm.state.value is PollResponseUiState.Closed)
        }

    @Test
    fun missing_poll_surfaces_error() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPoll("poll-1") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is PollResponseUiState.Error)
        }
}
