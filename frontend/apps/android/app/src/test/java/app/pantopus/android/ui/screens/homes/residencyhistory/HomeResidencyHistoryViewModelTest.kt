package app.pantopus.android.ui.screens.homes.residencyhistory

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeResidencyHistoryFailure
import app.pantopus.android.data.homes.HomeResidencyHistoryFailureKind
import app.pantopus.android.data.homes.HomeResidencyHistoryPage
import app.pantopus.android.data.homes.HomeResidencyReviewHistoryTransport
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class HomeResidencyHistoryViewModelTest {
    private val f = HistoryFixture()
    private val factory = mockk<HomeResidencyHistoryFactory>()
    private val transport = mockk<HomeResidencyReviewHistoryTransport>()
    private val session = mockk<HomeClaimSessionScope>()
    private val invalidated = MutableStateFlow(false)
    private lateinit var vm: HomeResidencyHistoryViewModel
    private val target get() = HomeResidencyHistoryTarget(f.home)
    private val populated get() = HomeResidencyHistoryPage(listOf(f.decoded()), null)

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { factory.transport } returns transport
        every { factory.session(any()) } returns session
        every { factory.identity(session) } returns HomeCreationScope("http://127.0.0.1:18084/", f.actor)
        every { session.invalidated } returns invalidated
        every { session.isCurrent } answers { !invalidated.value }
        coEvery { session.requireCurrent() } coAnswers { check(!invalidated.value) }
        coEvery { transport.session(any()) } returns f.scope
        coEvery { transport.list(f.home, f.scope, null) } returns populated
        coEvery { transport.read(f.reference(), f.scope) } returns f.decoded()
        vm = HomeResidencyHistoryViewModel(factory)
    }

    @After fun teardown() {
        vm.pause()
        Dispatchers.resetMain()
    }

    private fun retired() {
        assertTrue(vm.state.value.items.isEmpty())
        assertNull(vm.state.value.detail)
        assertNull(vm.state.value.nextCursor)
        assertFalse(vm.state.value.confirmed)
    }

    @Test fun authority_failure_clears_loaded_history_and_explicit_reload_is_fresh() =
        runTest {
            vm.resume(target)
            assertTrue(vm.state.value.confirmed)
            coEvery { transport.list(f.home, f.scope, null) } throws HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.Forbidden)
            vm.reload()
            retired()
            assertEquals(HomeResidencyHistoryFailureKind.Forbidden, vm.state.value.failure)
            coEvery { transport.list(f.home, f.scope, null) } returns HomeResidencyHistoryPage(emptyList(), null)
            vm.reload()
            assertTrue(vm.state.value.confirmed)
            assertTrue(vm.state.value.items.isEmpty())
            assertNull(vm.state.value.failure)
            coVerify(exactly = 3) { transport.session(any()) }
        }

    @Test fun held_old_list_cannot_restore_rows_after_newer_denial() =
        runTest {
            vm.resume(target)
            val held = CompletableDeferred<HomeResidencyHistoryPage>()
            coEvery { transport.list(f.home, f.scope, null) } coAnswers { held.await() }
            vm.reload()
            retired()
            assertTrue(vm.state.value.working)
            coEvery { transport.list(f.home, f.scope, null) } throws HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.Forbidden)
            vm.reload()
            held.complete(populated)
            retired()
            assertEquals(HomeResidencyHistoryFailureKind.Forbidden, vm.state.value.failure)
        }

    @Test fun held_pagination_retires_all_fields_and_cannot_overwrite_new_first_page() =
        runTest {
            val page = f.codec.page(f.page((200 downTo 181).map(f::item), f.cursor()), f.home, f.scope, null)
            coEvery { transport.list(f.home, f.scope, null) } returns page
            vm.resume(target)
            assertNotNull(vm.state.value.nextCursor)
            val held = CompletableDeferred<HomeResidencyHistoryPage>()
            coEvery { transport.list(f.home, f.scope, page.nextCursor) } coAnswers { held.await() }
            vm.nextPage()
            retired()
            coEvery { transport.list(f.home, f.scope, null) } returns HomeResidencyHistoryPage(listOf(f.decoded(201)), null)
            vm.reload()
            held.complete(HomeResidencyHistoryPage(listOf(f.decoded(180)), null))
            assertEquals(listOf(f.id(201)), vm.state.value.items.map { it.id })
        }

    @Test fun invalid_page_retires_anchor_and_reload_starts_without_old_cursor() =
        runTest {
            val page = f.codec.page(f.page((200 downTo 181).map(f::item), f.cursor()), f.home, f.scope, null)
            coEvery { transport.list(f.home, f.scope, null) } returns page
            coEvery {
                transport.list(f.home, f.scope, page.nextCursor)
            } throws HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.InvalidCursor)
            vm.resume(target)
            vm.nextPage()
            retired()
            vm.nextPage()
            coVerify(exactly = 1) { transport.list(f.home, f.scope, page.nextCursor) }
            vm.reload()
            coVerify(exactly = 2) { transport.list(f.home, f.scope, null) }
        }

    @Test fun closing_and_foreground_reentry_retire_list_detail_and_late_completions() =
        runTest {
            val held = CompletableDeferred<app.pantopus.android.data.homes.HomeResidencyHistoryItem>()
            coEvery { transport.read(f.reference(), f.scope) } coAnswers { withContext(NonCancellable) { held.await() } }
            vm.resume(HomeResidencyHistoryTarget(f.home, f.reference()))
            vm.pause()
            retired()
            coEvery { transport.list(f.home, f.scope, null) } throws HomeResidencyHistoryFailure(HomeResidencyHistoryFailureKind.Forbidden)
            vm.resume(target)
            held.complete(f.decoded())
            retired()
            assertEquals(HomeResidencyHistoryFailureKind.Forbidden, vm.state.value.failure)
        }

    @Test fun account_invalidation_retires_detail_and_foreign_post_ack_reference_is_not_requested() =
        runTest {
            vm.resume(HomeResidencyHistoryTarget(f.home, f.reference()))
            assertNotNull(vm.state.value.detail)
            invalidated.value = true
            retired()
            assertEquals(HomeResidencyHistoryFailureKind.SessionChanged, vm.state.value.failure)
            invalidated.value = false
            vm.resume(HomeResidencyHistoryTarget(f.home, f.reference().copy(actorId = f.id(99))))
            retired()
            coVerify(exactly = 1) { transport.read(any(), any()) }
        }
}
