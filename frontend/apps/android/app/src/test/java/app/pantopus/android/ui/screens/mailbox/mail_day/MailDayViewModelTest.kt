@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_day

import app.pantopus.android.data.api.models.mailbox.v2.MailDayActionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayFinishResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayRecapDto
import app.pantopus.android.data.api.models.mailbox.v2.MailDayRecapSegmentDto
import app.pantopus.android.data.api.models.mailbox.v2.MailDayReviewedDto
import app.pantopus.android.data.api.models.mailbox.v2.MailDayTodayResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayUnreviewedDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailday.MailDayRepository
import io.mockk.coEvery
import io.mockk.coVerify
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
 * A13.16 — coverage for the live My Mail Day view-model. The triage frame
 * comes from `GET /api/mailbox/v2/mailday/today`; accepting a suggestion
 * optimistically moves the card to the reviewed list and calls
 * `POST /items/:id/route` (rolling back on failure); finishing the day
 * POSTs `/finish` and reflects the bumped streak.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailDayViewModelTest {
    private val repository: MailDayRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun unreviewed(
        id: String,
        name: String = "Maria Kovács",
        avatar: String = "personal_sky",
    ) = MailDayUnreviewedDto(
        id = id,
        kind = "bill",
        label = "Con Edison bill",
        sender = "Con Edison · NY",
        suggestedName = name,
        suggestedAvatar = avatar,
        confidencePercent = 94,
        secondaryLabel = "Other",
    )

    private fun reviewed(id: String) =
        MailDayReviewedDto(
            id = id,
            kind = "magazine",
            label = "The New Yorker",
            action = "routed",
            routedTo = "Marcus",
            routedTint = "household_home",
            whenLabel = "2 min ago",
            undoCountdown = null,
        )

    private fun today(
        unreviewed: List<MailDayUnreviewedDto> = emptyList(),
        reviewed: List<MailDayReviewedDto> = emptyList(),
        recap: MailDayRecapDto? = null,
    ) = MailDayTodayResponse(
        dateLabel = "Thu · Oct 9",
        streakDays = 12,
        lastScanLabel = "22 min ago",
        unreviewed = unreviewed,
        reviewed = reviewed,
        yesterdayRecap = recap,
    )

    private fun vmWith(response: MailDayTodayResponse): MailDayViewModel {
        coEvery { repository.today() } returns NetworkResult.Success(response)
        coEvery { repository.route(any()) } returns NetworkResult.Success(MailDayActionResponse(reviewed("x")))
        coEvery { repository.finish() } returns NetworkResult.Success(MailDayFinishResponse(streakDays = 13))
        return MailDayViewModel(repository)
    }

    @Test
    fun loadProjectsTriageList() =
        runTest {
            val vm = vmWith(today(unreviewed = listOf(unreviewed("m1"), unreviewed("m2"))))
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Populated, got $state", state is MailDayUiState.Populated)
            val content = (state as MailDayUiState.Populated).content
            assertEquals(2, content.unreviewed.size)
            assertEquals(0, content.reviewed.size)
            assertEquals(MailDayKind.Bill, content.unreviewed[0].kind)
            assertEquals(MailDaySuggestedAvatar.PersonalSky, content.unreviewed[0].suggestedAvatar)
            assertEquals(94, content.unreviewed[0].confidencePercent)
            assertEquals(12, content.streakDays)
            assertEquals(2, vm.total)
            assertEquals(2, vm.remaining)
            assertFalse(vm.canFinishDay)
        }

    @Test
    fun loadProjectsEmptyWhenNothingToday() =
        runTest {
            val vm = vmWith(today())
            vm.load()
            assertTrue(vm.state.value is MailDayUiState.Empty)
        }

    @Test
    fun loadKeepsPopulatedWhenOnlyReviewed() =
        runTest {
            // A fully-triaged day stays populated (reviewed rail + finish bar).
            val vm = vmWith(today(reviewed = listOf(reviewed("r1"))))
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Populated, got $state", state is MailDayUiState.Populated)
            val content = (state as MailDayUiState.Populated).content
            assertEquals(MailDayRoutedTint.HouseholdHome, content.reviewed[0].routedTint)
            assertTrue(vm.canFinishDay)
        }

    @Test
    fun loadSurfacesError() =
        runTest {
            coEvery { repository.today() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = MailDayViewModel(repository)
            vm.load()
            assertTrue(vm.state.value is MailDayUiState.Error)
        }

    @Test
    fun acceptSuggestionMovesToReviewedAndRoutes() =
        runTest {
            val vm = vmWith(today(unreviewed = listOf(unreviewed("m1"), unreviewed("m2"))))
            vm.load()
            val target = (vm.state.value as MailDayUiState.Populated).content.unreviewed[0]
            vm.acceptSuggestion(target.id)
            val updated = (vm.state.value as MailDayUiState.Populated).content
            assertEquals(1, updated.unreviewed.size)
            assertEquals(1, updated.reviewed.size)
            assertEquals(target.id, updated.reviewed.first().id)
            assertEquals(ReviewedMailAction.Routed, updated.reviewed.first().action)
            assertEquals(5, updated.reviewed.first().undoCountdown)
            coVerify { repository.route(target.id) }
        }

    @Test
    fun acceptSuggestionRollsBackOnFailure() =
        runTest {
            val vm = vmWith(today(unreviewed = listOf(unreviewed("m1"), unreviewed("m2"))))
            coEvery { repository.route(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            vm.load()
            val target = (vm.state.value as MailDayUiState.Populated).content.unreviewed[0]
            vm.acceptSuggestion(target.id)
            val rolledBack = (vm.state.value as MailDayUiState.Populated).content
            assertEquals(2, rolledBack.unreviewed.size)
            assertEquals(0, rolledBack.reviewed.size)
        }

    @Test
    fun tickUndoDecrementsLatestAfterAccept() =
        runTest {
            val vm = vmWith(today(unreviewed = listOf(unreviewed("m1"))))
            vm.load()
            val target = (vm.state.value as MailDayUiState.Populated).content.unreviewed[0]
            vm.acceptSuggestion(target.id)
            vm.tickUndo()
            assertEquals(4, (vm.state.value as MailDayUiState.Populated).content.reviewed.first().undoCountdown)
        }

    @Test
    fun tickUndoClearsAtZero() =
        runTest {
            val vm = vmWith(today(unreviewed = listOf(unreviewed("m1"))))
            vm.load()
            val target = (vm.state.value as MailDayUiState.Populated).content.unreviewed[0]
            vm.acceptSuggestion(target.id)
            repeat(5) { vm.tickUndo() }
            assertNull((vm.state.value as MailDayUiState.Populated).content.reviewed.first().undoCountdown)
        }

    @Test
    fun canFinishDayOnceEverythingReviewed() =
        runTest {
            val vm = vmWith(today(unreviewed = listOf(unreviewed("m1"))))
            vm.load()
            assertFalse(vm.canFinishDay)
            val target = (vm.state.value as MailDayUiState.Populated).content.unreviewed[0]
            vm.acceptSuggestion(target.id)
            assertTrue(vm.canFinishDay)
        }

    @Test
    fun finishDayBumpsStreak() =
        runTest {
            val vm = vmWith(today(reviewed = listOf(reviewed("r1"))))
            vm.load()
            assertTrue(vm.canFinishDay)
            vm.finishDay()
            coVerify { repository.finish() }
            assertEquals(13, (vm.state.value as MailDayUiState.Populated).content.streakDays)
        }

    @Test
    fun mapsYesterdayRecapSegments() =
        runTest {
            val recap =
                MailDayRecapDto(
                    dateLabel = "Wed · Oct 8",
                    pieces = 2,
                    closedAtLabel = "closed 6:42 PM",
                    segments =
                        listOf(
                            MailDayRecapSegmentDto(id = "maria", percent = 0.5, label = "1 to Maria", tint = "person_primary"),
                            MailDayRecapSegmentDto(id = "junked", percent = 0.5, label = "1 junked", tint = "junked"),
                        ),
                )
            val vm = vmWith(today(recap = recap))
            vm.load()
            val content = (vm.state.value as MailDayUiState.Empty).content
            assertNotNull(content.yesterdayRecap)
            assertEquals(2, content.yesterdayRecap!!.segments.size)
            assertEquals(YesterdayRecap.SegmentTint.Junked, content.yesterdayRecap!!.segments[1].tint)
        }

    @Test
    fun requestScanInvokesConfiguredCallback() =
        runTest {
            val vm = vmWith(today())
            vm.load()
            var scanCalls = 0
            vm.configure(onScanRequested = { scanCalls++ })
            vm.requestScan()
            vm.requestScan()
            assertEquals(2, scanCalls)
        }
}
