@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.persona_dm

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.personadm.PersonaDmFanDto
import app.pantopus.android.data.api.models.personadm.PersonaDmMessageDto
import app.pantopus.android.data.api.models.personadm.PersonaDmPersonaDto
import app.pantopus.android.data.api.models.personadm.PersonaDmReplyPolicyStatusDto
import app.pantopus.android.data.api.models.personadm.PersonaDmThreadDetailResponse
import app.pantopus.android.data.api.models.personadm.PersonaDmThreadDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.personadm.PersonaDmRepository
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors iOS `PersonaDmThreadViewModelTests`: the thread projection
 * (viewer-relative bubble sides, fan-only reply-policy banner), the
 * empty-thread state, and the fan-inbox gate mapping for the backend's
 * first-class rejections (402 quota_exhausted / 403 blocked / no_membership /
 * tier_does_not_allow).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PersonaDmThreadViewModelTest {
    private val repository: PersonaDmRepository = mockk()

    private fun makeVm(): PersonaDmThreadViewModel =
        PersonaDmThreadViewModel(
            SavedStateHandle(
                mapOf(
                    PERSONA_DM_PERSONA_ID_KEY to "p1",
                    PERSONA_DM_THREAD_ID_KEY to "t1",
                ),
            ),
            repository,
        )

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fanThread(): PersonaDmThreadDetailResponse =
        PersonaDmThreadDetailResponse(
            thread = PersonaDmThreadDto(id = "t1", membershipId = "m1", status = "open"),
            fan = PersonaDmFanDto(handle = "maria_b", displayName = "Maria B."),
            persona = PersonaDmPersonaDto(handle = "sourdough", displayName = "The Sourdough Diary"),
            viewerRole = "fan",
            messages =
                listOf(
                    PersonaDmMessageDto(
                        id = "m_1",
                        threadId = "t1",
                        senderRole = "fan",
                        body = "Can I sub bread flour for AP?",
                        createdAt = "2026-05-10T10:00:00.000Z",
                        readAt = "2026-05-10T11:00:00.000Z",
                    ),
                    PersonaDmMessageDto(
                        id = "m_2",
                        threadId = "t1",
                        senderRole = "creator",
                        body = "Yes — drop hydration by 5g per 100g.",
                        createdAt = "2026-05-10T12:00:00.000Z",
                    ),
                ),
            replyPolicyStatus =
                PersonaDmReplyPolicyStatusDto(
                    status = "on_track",
                    policy = "within_3_days",
                    slaDays = 3,
                    daysRemaining = 2,
                ),
        )

    @Test
    fun `load projects the fan thread with its policy banner`() =
        runTest {
            coEvery { repository.thread("p1", "t1") } returns NetworkResult.Success(fanThread())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PersonaDmThreadUiState.Loaded
            assertEquals(PersonaDmViewerRole.Fan, loaded.content.viewerRole)
            assertEquals("@sourdough", loaded.content.title)
            assertEquals("The Sourdough Diary", loaded.content.subtitle)
            assertEquals(2, loaded.content.messages.size)
            assertTrue(loaded.content.messages[0].fromViewer)
            assertFalse(loaded.content.messages[1].fromViewer)
            assertEquals(PersonaDmPolicyBannerKind.OnTrack, loaded.content.policyBanner?.kind)
            assertEquals("Reply within 3 days.", loaded.content.policyBanner?.text)
        }

    @Test
    fun `sla missed banner names the window and the refund`() {
        val banner =
            PersonaDmThreadViewModel.policyBanner(
                PersonaDmReplyPolicyStatusDto(status = "sla_missed", policy = "within_7_days", slaDays = 7),
            )
        assertEquals(PersonaDmPolicyBannerKind.Missed, banner?.kind)
        assertTrue(banner!!.text.contains("7-day reply window"))
        assertTrue(banner.text.contains("refund"))
    }

    @Test
    fun `creator viewer gets no policy banner`() =
        runTest {
            coEvery { repository.thread("p1", "t1") } returns
                NetworkResult.Success(
                    fanThread().copy(
                        viewerRole = "creator",
                        fan = PersonaDmFanDto(handle = "derek_tan", displayName = "Derek Tan"),
                        replyPolicyStatus = null,
                    ),
                )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PersonaDmThreadUiState.Loaded
            assertEquals(PersonaDmViewerRole.Creator, loaded.content.viewerRole)
            assertNull(loaded.content.policyBanner)
            assertEquals("@derek_tan", loaded.content.title)
            // Creator viewer: the creator's own message sits on the right.
            assertTrue(loaded.content.messages.last().fromViewer)
        }

    @Test
    fun `empty message list transitions to empty with the header intact`() =
        runTest {
            coEvery { repository.thread("p1", "t1") } returns
                NetworkResult.Success(fanThread().copy(messages = emptyList(), replyPolicyStatus = null))
            val vm = makeVm()
            vm.load()
            val empty = vm.state.value as PersonaDmThreadUiState.Empty
            assertEquals("@sourdough", empty.content.title)
            assertTrue(empty.content.messages.isEmpty())
        }

    @Test
    fun `load failure transitions to error`() =
        runTest {
            coEvery { repository.thread("p1", "t1") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is PersonaDmThreadUiState.Error)
        }

    @Test
    fun `blocked send gets its own copy`() {
        assertEquals(
            "This profile can't accept new messages from your account.",
            PersonaDmThreadViewModel.sendErrorMessage(NetworkError.Forbidden),
        )
    }

    // --- Fan inbox gates ---------------------------------------------------

    @Test
    fun `gate derived from membership state`() {
        assertEquals(
            FanInboxGate.NoMembership,
            FanInboxViewModel.gate(membershipMissing = true, perPeriod = 5, remaining = 5),
        )
        assertEquals(
            FanInboxGate.TierDoesNotAllow,
            FanInboxViewModel.gate(membershipMissing = false, perPeriod = 0, remaining = null),
        )
        assertEquals(
            FanInboxGate.TierDoesNotAllow,
            FanInboxViewModel.gate(membershipMissing = false, perPeriod = null, remaining = null),
        )
        assertEquals(
            FanInboxGate.QuotaExhausted,
            FanInboxViewModel.gate(membershipMissing = false, perPeriod = 5, remaining = 0),
        )
        assertNull(FanInboxViewModel.gate(membershipMissing = false, perPeriod = 5, remaining = 3))
        // Negative allowance means unlimited — never gated.
        assertNull(FanInboxViewModel.gate(membershipMissing = false, perPeriod = -1, remaining = null))
    }

    @Test
    fun `open thread rejections map to gates`() {
        assertEquals(
            FanInboxGate.QuotaExhausted,
            FanInboxViewModel.gateFor(NetworkError.ClientError(402, """{"error":"quota_exhausted"}""")),
        )
        assertEquals(FanInboxGate.Blocked, FanInboxViewModel.gateFor(NetworkError.Forbidden))
        assertEquals(FanInboxGate.NoMembership, FanInboxViewModel.gateFor(NetworkError.NotFound))
    }

    @Test
    fun `open confirmation states the remaining quota`() {
        assertEquals("Sent. 2 threads left this period.", FanInboxViewModel.openConfirmationCopy(2))
        assertEquals("Sent. 1 thread left this period.", FanInboxViewModel.openConfirmationCopy(1))
        assertEquals("Sent.", FanInboxViewModel.openConfirmationCopy(null))
    }

    @Test
    fun `quota chip label`() {
        assertEquals("3 of 5 left", FanInboxQuota(remaining = 3, limit = 5).chipLabel)
        assertEquals(
            "No message threads on this tier",
            FanInboxQuota(remaining = null, limit = null).chipLabel,
        )
        assertEquals("Unlimited message threads", FanInboxQuota(remaining = null, limit = -1).chipLabel)
    }
}
