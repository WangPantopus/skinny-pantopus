@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.disambiguate

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingRequest
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
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

@OptIn(ExperimentalCoroutinesApi::class)
class DisambiguateMailFormViewModelTest {
    private val repo: MailboxRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(confidence: Double): DisambiguateMailFormViewModel =
        DisambiguateMailFormViewModel(
            repo = repo,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        DISAMBIGUATE_MAIL_ID_KEY to "mail-1",
                        DISAMBIGUATE_OCR_TEXT_KEY to "Maria K. · 412 Elm St",
                        DISAMBIGUATE_CONFIDENCE_KEY to confidence,
                    ),
                ),
        )

    // MARK: - Tone gating

    @Test fun clean_confidence_yields_clean_tone_and_preselect() {
        val state = makeVm(0.97).state.value
        assertFalse(state.isUnclear)
        assertEquals(MailRoutingSelection.Candidate("maria"), state.selection)
        assertTrue(state.canConfirm)
        assertNull(state.confirmHint)
        assertEquals("Who is this for?", state.candidatesOverline)
    }

    @Test fun unclear_confidence_blocks_confirm_and_shows_hint() {
        val state = makeVm(0.31).state.value
        assertTrue(state.isUnclear)
        assertNull(state.selection)
        assertFalse(state.canConfirm)
        assertNotNull(state.confirmHint)
        assertEquals("Best guesses · none confident", state.candidatesOverline)
    }

    // MARK: - Match scoring

    @Test fun match_tier_thresholds() {
        assertEquals(MailMatchTier.Strong, MailMatchTier.fromScore(0.97))
        assertEquals(MailMatchTier.Strong, MailMatchTier.fromScore(0.70))
        assertEquals(MailMatchTier.Partial, MailMatchTier.fromScore(0.41))
        assertEquals(MailMatchTier.Partial, MailMatchTier.fromScore(0.35))
        assertEquals(MailMatchTier.Weak, MailMatchTier.fromScore(0.22))
    }

    @Test fun candidate_percent_and_tier() {
        val candidates = makeVm(0.97).state.value.candidates
        val maria = candidates.first { it.id == "maria" }
        assertEquals(97, maria.matchPercent)
        assertEquals(MailMatchTier.Strong, maria.tier)
        assertEquals(MailMatchTier.Weak, candidates.first { it.id == "mika" }.tier)
    }

    // MARK: - Selection / quick actions

    @Test fun select_candidate_in_clean_frame() {
        val vm = makeVm(0.97)
        vm.selectCandidate("marcus")
        assertTrue(vm.state.value.isSelected("marcus"))
        assertTrue(vm.state.value.canConfirm)
    }

    @Test fun select_candidate_ignored_in_unclear_frame() {
        val vm = makeVm(0.31)
        vm.selectCandidate("maria")
        assertNull(vm.state.value.selection)
        assertFalse(vm.state.value.canConfirm)
    }

    @Test fun this_is_me_selects_me() {
        val vm = makeVm(0.97)
        vm.selectThisIsMe()
        assertEquals(MailRoutingSelection.Me, vm.state.value.selection)
        assertTrue(vm.state.value.canConfirm)
    }

    @Test fun route_to_other_clears_selection() {
        val vm = makeVm(0.97)
        assertNotNull(vm.state.value.selection) // starts auto-picked
        vm.routeToOther()
        assertNull(vm.state.value.selection)
        assertFalse(vm.state.value.canConfirm)
    }

    @Test fun fallback_records_choice_and_toast() {
        val vm = makeVm(0.31)
        vm.selectFallback(FallbackAction.MarkAsJunk)
        assertEquals(FallbackAction.MarkAsJunk, vm.state.value.lastFallback)
        assertEquals(false, vm.state.value.toast?.isError)
        assertTrue(vm.state.value.isDirty)
    }

    @Test fun add_new_person_surfaces_toast() {
        val vm = makeVm(0.97)
        vm.addNewPerson()
        assertNotNull(vm.state.value.toast)
        assertEquals(false, vm.state.value.toast?.isError)
    }

    // MARK: - Submit

    @Test fun submit_candidate_sends_drawer() =
        runTest {
            val captured = slot<ResolveRoutingRequest>()
            coEvery { repo.resolve(capture(captured)) } returns
                NetworkResult.Success(ResolveRoutingResponse(message = "ok", drawer = "home"))
            val vm = makeVm(0.97)
            vm.selectCandidate("maria")
            vm.submit()
            assertEquals("home", captured.captured.drawer)
            assertEquals("mail-1", captured.captured.mailId)
            assertNull(captured.captured.addAlias)
            assertNull(captured.captured.aliasString)
            advanceTimeBy(1_600)
            runCurrent()
            assertTrue(vm.state.value.shouldDismiss)
        }

    @Test fun submit_this_is_me_sends_personal_drawer() =
        runTest {
            val captured = slot<ResolveRoutingRequest>()
            coEvery { repo.resolve(capture(captured)) } returns
                NetworkResult.Success(ResolveRoutingResponse(message = "ok", drawer = "personal"))
            val vm = makeVm(0.97)
            vm.selectThisIsMe()
            vm.submit()
            assertEquals("personal", captured.captured.drawer)
        }

    @Test fun submit_unclear_frame_blocked() =
        runTest {
            val vm = makeVm(0.31)
            vm.submit()
            coVerify(exactly = 0) { repo.resolve(any()) }
            assertEquals(true, vm.state.value.toast?.isError)
        }

    @Test fun submit_failure_surfaces_error_toast() =
        runTest {
            coEvery { repo.resolve(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm(0.97)
            vm.selectCandidate("maria")
            vm.submit()
            assertEquals(true, vm.state.value.toast?.isError)
        }
}
