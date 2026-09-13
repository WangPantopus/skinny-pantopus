package app.pantopus.android.ui.screens.homes.residencyhistory

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.homes.HomeResidencyCurrentReview
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyHistoryReference
import app.pantopus.android.data.homes.HomeResidencyReviewCodec
import app.pantopus.android.data.homes.HomeResidencyReviewFailure
import app.pantopus.android.data.homes.HomeResidencyReviewFailureKind
import app.pantopus.android.data.homes.HomeResidencyReviewRole
import app.pantopus.android.data.homes.HomeResidencyReviewScope
import app.pantopus.android.data.homes.HomeResidencyReviewTransport
import app.pantopus.android.data.homes.PendingHomeResidencyReview
import app.pantopus.android.data.homes.PendingHomeResidencyReviewStore
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.homes.residencyreview.HomeResidencyReviewCoordinator
import app.pantopus.android.ui.screens.homes.residencyreview.HomeResidencyReviewFactory
import app.pantopus.android.ui.screens.homes.residencyreview.HomeResidencyReviewViewModel
import com.squareup.moshi.Moshi
import io.mockk.coEvery
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class HomeResidencyHistoryAcknowledgementTest {
    private val f = HistoryFixture()
    private val codec = HomeResidencyReviewCodec(Moshi.Builder().build())
    private val session = mockk<HomeClaimSessionScope>()
    private val invalidated = MutableStateFlow(false)
    private val scope = HomeResidencyReviewScope("http://127.0.0.1:18084/", f.actor, f.home)
    private var saved: PendingHomeResidencyReview? = null
    private var failClear = false
    private var heldClear: CompletableDeferred<Unit>? = null
    private lateinit var vm: HomeResidencyReviewViewModel
    private val store = object : PendingHomeResidencyReviewStore {
        override suspend fun read(scope: HomeResidencyReviewScope) = saved

        override suspend fun replace(scope: HomeResidencyReviewScope, expected: PendingHomeResidencyReview?, next: PendingHomeResidencyReview?) {
            check(saved == expected)
            if (next == null) {
                heldClear?.let { withContext(NonCancellable) { it.await() } }
                if (failClear) throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.Storage)
            }
            saved = next
        }
    }
    private val transport = object : HomeResidencyReviewTransport {
        override suspend fun read(scope: HomeResidencyReviewScope, claimId: String, sessionScope: String?): HomeResidencyCurrentReview =
            HomeResidencyCurrentReview(f.home, f.actor, f.scope.sessionScope,
                mapOf("id" to claimId, "user_id" to f.id(5), "status" to "verified", "review_token" to "b".repeat(64)), null)

        override suspend fun decide(draft: PendingHomeResidencyReview, sessionScope: String): String = error("History link must never submit a command")
    }

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { session.invalidated } returns invalidated
        every { session.isCurrent } answers { !invalidated.value }
        coEvery { session.requireCurrent() } coAnswers { check(!invalidated.value) }
        val draft = PendingHomeResidencyReview(scope, f.id(3), f.id(201), HomeResidencyDecision.Approve,
            codec.request(f.id(201), "b".repeat(64), HomeResidencyDecision.Approve, HomeResidencyReviewRole.Member, ""))
        val receipt = mapOf("id" to f.id(200), "home_id" to f.home, "claim_id" to f.id(3), "actor_id" to f.actor,
            "request_id" to draft.requestId, "action" to "approve", "review_token" to "b".repeat(64), "request_hash" to "c".repeat(64),
            "legacy_request" to false, "created_at" to f.created,
            "result" to mapOf("status" to "verified", "reviewed_at" to f.created, "occupancy_id" to f.id(4), "role_base" to "member"))
        saved = draft.copy(receiptJson = codec.receipt(receipt, draft))
        val coordinator = HomeResidencyReviewCoordinator(scope, store, codec, transport, session::requireCurrent)
        val factory = mockk<HomeResidencyReviewFactory>()
        every { factory.codec } returns codec
        every { factory.create(session, f.home) } returns coordinator
        coEvery { factory.publicName(any()) } returns null
        val sessions = mockk<HomeClaimSessionScopeFactory>()
        every { sessions.create(any()) } returns session
        val network = mockk<NetworkMonitor>()
        every { network.isOnline } returns MutableStateFlow(true)
        vm = HomeResidencyReviewViewModel(SavedStateHandle(mapOf("homeId" to f.home)), factory, sessions, network)
        vm.show()
    }

    @After fun teardown() {
        vm.dismiss()
        Dispatchers.resetMain()
    }

    @Test fun successful_actual_acknowledgement_exposes_only_real_receipt_id_and_retires_on_pause() = runTest {
        vm.acknowledge()
        assertNull(saved)
        val reference = HomeResidencyHistoryReference(f.home, f.actor, f.id(200))
        assertEquals(reference, vm.state.value.acknowledgedHistory)
        var opened: HomeResidencyHistoryReference? = null
        vm.openAcknowledgedHistory { opened = it }
        assertEquals(reference, opened)
        vm.pause()
        assertNull(vm.state.value.acknowledgedHistory)
        opened = null
        vm.openAcknowledgedHistory { opened = it }
        assertNull(opened)
    }

    @Test fun failed_clear_retains_original_without_history_navigation() = runTest {
        failClear = true
        vm.acknowledge()
        assertNotNull(saved)
        assertNull(vm.state.value.acknowledgedHistory)
        assertNotNull(vm.state.value.error)
    }

    @Test fun late_clear_after_close_cannot_publish_post_ack_reference() = runTest {
        val held = CompletableDeferred<Unit>()
        heldClear = held
        vm.acknowledge()
        assertNull(vm.state.value.acknowledgedHistory)
        vm.dismiss()
        held.complete(Unit)
        assertNull(vm.state.value.acknowledgedHistory)
    }
}
