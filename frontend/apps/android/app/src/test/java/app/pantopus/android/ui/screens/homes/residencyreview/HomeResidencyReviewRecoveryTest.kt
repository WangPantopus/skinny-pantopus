package app.pantopus.android.ui.screens.homes.residencyreview

import app.pantopus.android.data.homes.HomeResidencyCurrentReview
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyReviewCodec
import app.pantopus.android.data.homes.HomeResidencyReviewRole
import app.pantopus.android.data.homes.HomeResidencyReviewScope
import app.pantopus.android.data.homes.HomeResidencyReviewTransport
import app.pantopus.android.data.homes.PendingHomeResidencyReview
import app.pantopus.android.data.homes.PendingHomeResidencyReviewStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeResidencyReviewRecoveryTest {
    private val codec = HomeResidencyReviewCodec(Moshi.Builder().build())
    private val scope = HomeResidencyReviewScope("http://127.0.0.1:18084/", id(1), id(2))
    private val claim = id(3)
    private var saved: PendingHomeResidencyReview? = null
    private var failInitial = false
    private var failProof = false
    private var cancelAfterClear = false
    private var heldRead: CompletableDeferred<Unit>? = null
    private val readStarted = CompletableDeferred<Unit>()
    private val posts = mutableListOf<PendingHomeResidencyReview>()
    private val store =
        object : PendingHomeResidencyReviewStore {
            override suspend fun read(scope: HomeResidencyReviewScope) = saved

            override suspend fun replace(
                scope: HomeResidencyReviewScope,
                expected: PendingHomeResidencyReview?,
                next: PendingHomeResidencyReview?,
            ) {
                check(saved == expected)
                check(!failInitial || expected != null)
                check(!failProof || next?.receiptJson == null)
                saved = next
                if (next == null && cancelAfterClear) throw CancellationException("Screen retired after committed acknowledgement")
            }
        }
    private val transport =
        object : HomeResidencyReviewTransport {
            override suspend fun read(
                scope: HomeResidencyReviewScope,
                claimId: String,
                sessionScope: String?,
            ): HomeResidencyCurrentReview {
                heldRead?.let {
                    readStarted.complete(Unit)
                    it.await()
                }
                return HomeResidencyCurrentReview(
                    scope.homeId,
                    scope.actorId,
                    "b".repeat(64),
                    mapOf("id" to claimId, "user_id" to id(4), "status" to "pending", "review_token" to "a".repeat(64)),
                    null,
                )
            }

            override suspend fun decide(
                draft: PendingHomeResidencyReview,
                sessionScope: String,
            ): String {
                posts += draft
                return proof(draft)
            }
        }

    private fun subject() = HomeResidencyReviewCoordinator(scope, store, codec, transport, {})

    private suspend fun HomeResidencyReviewCoordinator.prepareApproval() {
        open(claim)
        prepare(HomeResidencyDecision.Approve, HomeResidencyReviewRole.Member, "")
    }

    private fun proof(
        draft: PendingHomeResidencyReview,
        actor: String = scope.actorId,
    ): String =
        codec.receipt(
            mapOf(
                "id" to id(5), "home_id" to scope.homeId, "claim_id" to claim,
                "actor_id" to actor, "request_id" to draft.requestId, "action" to draft.action.wire,
                "review_token" to "a".repeat(64), "request_hash" to "c".repeat(64), "legacy_request" to false,
                "created_at" to "2026-09-12T00:00:00Z",
                "result" to
                    mapOf(
                        "status" to "verified", "reviewed_at" to "2026-09-12T00:00:00Z",
                        "occupancy_id" to id(6), "role_base" to "member",
                    ),
            ),
            draft,
        )

    @Test fun protected_write_failure_blocks_dispatch_and_known_proof_repairs_without_another_post() =
        runTest {
            val review = subject()
            failInitial = true
            assertTrue(runCatching { review.prepareApproval() }.isFailure)
            assertNull(saved)
            assertTrue(posts.isEmpty())
            failInitial = false
            review.prepareApproval()
            val original = saved
            failProof = true
            assertTrue(runCatching { review.resolve() }.isFailure)
            assertEquals(original, saved)
            assertTrue(review.receipt != null)
            assertEquals(1, posts.size)
            failProof = false
            review.resolve()
            assertEquals(original?.requestJson, saved?.requestJson)
            assertTrue(saved?.receiptJson != null)
            assertEquals(1, posts.size)
        }

    @Test fun retired_preflight_keeps_original_and_sends_no_decision() =
        runTest {
            val review = subject()
            review.prepareApproval()
            val original = saved
            heldRead = CompletableDeferred()
            val checking = async { runCatching { review.resolve() } }
            readStarted.await()
            review.hide()
            checkNotNull(heldRead).complete(Unit)
            assertTrue(checking.await().isFailure)
            assertEquals(original, saved)
            assertNull(review.review)
            assertTrue(posts.isEmpty())
            heldRead = null
            review.open(null)
            review.resolve()
            assertEquals(original?.requestJson, posts.single().requestJson)
        }

    @Test fun acknowledged_clear_reconciles_a_cancelled_io_return() =
        runTest {
            val review = subject()
            review.prepareApproval()
            review.resolve()
            cancelAfterClear = true
            assertTrue(runCatching { review.acknowledge(null) }.exceptionOrNull() is CancellationException)
            assertNull(saved)
            review.hide()
            review.open(null)
            assertNull(review.pending)
            assertNull(review.receipt)
            review.prepareApproval()
            assertTrue(saved != null)
            assertEquals(1, posts.size)
        }

    @Test fun unexpectedly_missing_original_cannot_be_replaced_or_confused_with_acknowledgement() =
        runTest {
            val review = subject()
            review.prepareApproval()
            review.resolve()
            val retained = saved
            saved = null
            review.hide()
            assertTrue(runCatching { review.open(claim) }.isFailure)
            assertTrue(runCatching { review.prepareApproval() }.isFailure)
            saved = retained
            review.open(null)
            assertEquals(retained, review.pending)
            assertEquals(1, posts.size)
        }

    @Test fun historical_receipt_must_belong_to_the_original_reviewer_and_claim() =
        runTest {
            subject().prepareApproval()
            val draft = checkNotNull(saved)
            assertTrue(codec.valid(draft.copy(receiptJson = proof(draft)), scope))
            assertTrue(runCatching { proof(draft, id(7)) }.isFailure)
            assertFalse(codec.valid(draft.copy(claimId = id(8), receiptJson = proof(draft)), scope))
        }

    private fun id(value: Int) = "ddc24300-0000-4000-8000-${value.toString().padStart(12, '0')}"
}
