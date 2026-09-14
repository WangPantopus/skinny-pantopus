package app.pantopus.android.ui.screens.homes.residencyqueue

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeResidencyQueueFailure
import app.pantopus.android.data.homes.HomeResidencyQueueFailureKind
import app.pantopus.android.data.homes.HomeResidencyQueuePage
import app.pantopus.android.data.homes.HomeResidencyQueueTransport
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class HomeResidencyQueueViewModelTest {
    private val f = QueueFixture()
    private val factory = mockk<HomeResidencyQueueFactory>()
    private val transport = mockk<HomeResidencyQueueTransport>()
    private val session = mockk<HomeClaimSessionScope>()
    private val invalidated = MutableStateFlow(false)
    private lateinit var vm: HomeResidencyQueueViewModel
    private val populated get() = f.decoded()

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { factory.transport } returns transport
        every { factory.session(any()) } returns session
        every { factory.identity(session) } returns HomeCreationScope("http://127.0.0.1:18084/", f.actor)
        every { session.invalidated } returns invalidated
        every { session.isCurrent } answers { !invalidated.value }
        coEvery { session.requireCurrent() } coAnswers { check(!invalidated.value) }
        coEvery { transport.session(any()) } returns f.scope
        coEvery { transport.list(f.home, f.scope) } returns populated
        vm = HomeResidencyQueueViewModel(factory)
    }

    @After fun teardown() {
        vm.pause()
        Dispatchers.resetMain()
    }

    private fun retired() {
        assertTrue(vm.state.value.claims.isEmpty())
        assertFalse(vm.state.value.confirmed)
    }

    @Test fun authority_failure_clears_loaded_history_and_explicit_reload_is_fresh() =
        runTest {
            vm.resume(f.home)
            assertTrue(vm.state.value.confirmed)
            coEvery { transport.list(f.home, f.scope) } throws HomeResidencyQueueFailure(HomeResidencyQueueFailureKind.Forbidden)
            vm.reload()
            retired()
            assertEquals(HomeResidencyQueueFailureKind.Forbidden, vm.state.value.failure)
            coEvery { transport.list(f.home, f.scope) } returns HomeResidencyQueuePage(emptyList())
            vm.reload()
            assertTrue(vm.state.value.confirmed)
            assertTrue(vm.state.value.claims.isEmpty())
            assertNull(vm.state.value.failure)
            coVerify(exactly = 3) { transport.session(any()) }
        }

    @Test fun held_old_list_cannot_restore_rows_after_newer_denial() =
        runTest {
            vm.resume(f.home)
            val held = CompletableDeferred<HomeResidencyQueuePage>()
            coEvery { transport.list(f.home, f.scope) } coAnswers { held.await() }
            vm.reload()
            retired()
            assertTrue(vm.state.value.working)
            coEvery { transport.list(f.home, f.scope) } throws HomeResidencyQueueFailure(HomeResidencyQueueFailureKind.Forbidden)
            vm.reload()
            held.complete(populated)
            retired()
            assertEquals(HomeResidencyQueueFailureKind.Forbidden, vm.state.value.failure)
        }

    @Test fun paused_read_cannot_repopulate_after_reentry_even_if_cancellation_is_ignored() =
        runTest {
            val held = CompletableDeferred<HomeResidencyQueuePage>()
            coEvery { transport.list(f.home, f.scope) } coAnswers { withContext(NonCancellable) { held.await() } }
            vm.resume(f.home)
            vm.pause()
            vm.reload()
            coVerify(exactly = 1) { transport.session(any()) }
            assertFalse(vm.beginReview(f.id))
            coEvery { transport.list(f.home, f.scope) } throws HomeResidencyQueueFailure(HomeResidencyQueueFailureKind.Forbidden)
            vm.resume(f.home)
            held.complete(populated)
            retired()
            assertEquals(HomeResidencyQueueFailureKind.Forbidden, vm.state.value.failure)
        }

    @Test fun account_change_clears_rows_and_blocks_old_actions() =
        runTest {
            vm.resume(f.home)
            invalidated.value = true
            retired()
            assertEquals(HomeResidencyQueueFailureKind.SessionChanged, vm.state.value.failure)
            assertFalse(vm.beginReview(f.id))
            vm.reload()
            coVerify(exactly = 1) { transport.session(any()) }
        }

    @Test fun rendering_does_not_reuse_the_collectors_pre_background_snapshot() =
        runTest {
            vm.resume(f.home)
            val observed = vm.state.value
            vm.pause()
            assertTrue(vm.displayState(observed).claims.isEmpty())
            val held = CompletableDeferred<HomeResidencyQueuePage>()
            coEvery { transport.list(f.home, f.scope) } coAnswers { held.await() }
            vm.resume(f.home)
            assertTrue(vm.displayState(observed).claims.isEmpty())
            assertTrue(vm.displayState(observed).working)
            held.complete(populated)
        }

    @Test fun exact_current_claim_is_required_and_review_retires_rows_before_opening() =
        runTest {
            vm.resume(f.home)
            assertFalse(vm.beginReview(f.actor))
            assertTrue(vm.beginReview(f.id))
            retired()
            assertFalse(vm.beginReview(f.id))
        }

    @Test fun session_change_during_bootstrap_prevents_list_dispatch() =
        runTest {
            val held = CompletableDeferred<app.pantopus.android.data.homes.HomeResidencyQueueSession>()
            coEvery { transport.session(any()) } coAnswers { withContext(NonCancellable) { held.await() } }
            vm.resume(f.home)
            invalidated.value = true
            held.complete(f.scope)
            retired()
            coVerify(exactly = 0) { transport.list(any(), any()) }
        }
}
