package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
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

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class HomeMemberRemovalViewModelTest {
    private val fixture = RemovalFixture()
    private val factory = mockk<HomeMemberRemovalFactory>()
    private val auth = mockk<AuthRepository>()
    private val session = mockk<HomeClaimSessionScope>()
    private val invalidated = MutableStateFlow(false)
    private lateinit var viewModel: HomeMemberRemovalViewModel
    private val target get() = HomeMemberRemovalTarget(fixture.home, fixture.target)

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        every { factory.session(any()) } returns session
        every { factory.create(session) } answers { fixture.coordinator() }
        every { session.invalidated } returns invalidated
        every { session.actorId } returns fixture.scope.actorId
        every { session.isCurrent } answers { fixture.current && !invalidated.value }
        coEvery { session.requireCurrent() } coAnswers { check(fixture.current && !invalidated.value) }
        viewModel = HomeMemberRemovalViewModel(factory, auth)
    }

    @After fun teardown() {
        viewModel.pause()
        Dispatchers.resetMain()
    }

    @Test fun self_leave_uses_live_session_actor_and_same_protected_original() =
        runTest {
            viewModel.resume(HomeMemberRemovalTarget(fixture.home, self = true))
            assertEquals(fixture.scope.actorId, viewModel.state.value.context?.intent?.targetUserId)
            assertTrue(fixture.calls.isEmpty())
            viewModel.submit(fixture.decision, viewModel.state.value.generation)
            assertEquals(fixture.scope.actorId, fixture.store.value?.request?.intent?.targetUserId)
            assertEquals(1, fixture.commits)
        }

    @Test fun stale_confirmation_after_pause_cannot_save_or_submit() =
        runTest {
            viewModel.resume(target)
            val before = viewModel.state.value
            assertTrue(before.canSubmit)
            viewModel.pause()
            viewModel.submit(fixture.decision, before.generation)
            assertNull(fixture.store.value)
            assertTrue(fixture.calls.isEmpty())
            assertNull(viewModel.state.value.context)
        }

    @Test fun account_invalidation_clears_prepared_identity_immediately() =
        runTest {
            viewModel.resume(target)
            assertNotNull(viewModel.state.value.context)
            invalidated.value = true
            assertNull(viewModel.state.value.context)
            assertFalse(viewModel.state.value.canSubmit)
            assertTrue(viewModel.state.value.accountLabel.isEmpty())
            assertNotNull(viewModel.state.value.error)
        }

    @Test fun held_reply_after_pause_keeps_original_but_cannot_repopulate_visible_result() =
        runTest {
            viewModel.resume(target)
            fixture.hold = CompletableDeferred()
            viewModel.submit(fixture.decision, viewModel.state.value.generation)
            assertNotNull(fixture.store.value)
            viewModel.pause()
            fixture.hold?.complete(Unit)
            assertNull(viewModel.state.value.pending)
            assertNull(viewModel.state.value.outcome)
            fixture.hold = null
            viewModel.resume(HomeMemberRemovalTarget())
            assertEquals("completed", viewModel.state.value.outcome?.state)
            assertEquals(1, fixture.commits)
        }

    @Test fun stale_acknowledgement_never_closes_new_visible_lifetime_or_clears_original() =
        runTest {
            viewModel.resume(target)
            viewModel.submit(fixture.decision, viewModel.state.value.generation)
            val before = viewModel.state.value
            val original = requireNotNull(before.pending)
            viewModel.resume(HomeMemberRemovalTarget())
            var closed = false
            viewModel.acknowledge(original.request.requestId, before.generation) { closed = true }
            assertFalse(closed)
            assertNotNull(fixture.store.value)
            viewModel.acknowledge(original.request.requestId, viewModel.state.value.generation) { closed = true }
            assertTrue(closed)
            assertNull(fixture.store.value)
        }
}
