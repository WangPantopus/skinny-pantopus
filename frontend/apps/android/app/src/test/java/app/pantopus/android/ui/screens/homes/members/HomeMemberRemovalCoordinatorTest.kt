package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeMemberRemovalCodec
import app.pantopus.android.data.homes.HomeMemberRemovalContext
import app.pantopus.android.data.homes.HomeMemberRemovalCurrent
import app.pantopus.android.data.homes.HomeMemberRemovalIntent
import app.pantopus.android.data.homes.HomeMemberRemovalOutcome
import app.pantopus.android.data.homes.HomeMemberRemovalRecovery
import app.pantopus.android.data.homes.HomeMemberRemovalTransport
import app.pantopus.android.data.homes.PendingHomeMemberRemoval
import app.pantopus.android.data.homes.PendingHomeMemberRemovalStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class HomeMemberRemovalCoordinatorTest {
    private val fixture = RemovalFixture()

    @Test fun prepare_does_not_submit_and_original_is_durable_before_dispatch() =
        runTest {
            val coordinator = fixture.coordinator()
            coordinator.open()
            coordinator.prepare(fixture.intent())
            assertTrue(coordinator.canSubmit)
            assertTrue(fixture.calls.isEmpty())
            coordinator.submit(fixture.decision)
            assertEquals(listOf(HomeMemberRemovalRecovery.Retry), fixture.calls.map { it.first })
            val original = requireNotNull(fixture.store.value)
            assertEquals(original.requestJson, fixture.calls.single().second.requestJson)
            assertTrue(coordinator.canAcknowledge)
            assertEquals("completed", coordinator.outcome?.state)
        }

    @Test fun storage_failure_prevents_post_and_requires_reopening_before_another_attempt() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.store.failOriginal = true
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            assertTrue(fixture.calls.isEmpty())
            assertFalse(coordinator.canPrepare)
            assertFalse(coordinator.canSubmit)
        }

    @Test fun unavailable_protected_store_never_looks_like_an_empty_original() =
        runTest {
            fixture.store.failRead = true
            val coordinator = fixture.coordinator()
            assertTrue(runCatching { coordinator.open() }.isFailure)
            assertFalse(coordinator.canPrepare)
            assertTrue(fixture.calls.isEmpty())
        }

    @Test fun lost_reply_then_failed_cold_read_retains_exact_original_for_explicit_retry() =
        runTest {
            val first = fixture.prepared()
            fixture.failAfterCommit = true
            assertTrue(runCatching { first.submit(fixture.decision) }.isFailure)
            val original = requireNotNull(fixture.store.value)
            fixture.failRead = true
            val restarted = fixture.coordinator()
            assertTrue(runCatching { restarted.open() }.isFailure)
            assertEquals(original, restarted.pending)
            assertFalse(restarted.canPrepare)
            fixture.failRead = false
            fixture.failAfterCommit = false
            restarted.recover(HomeMemberRemovalRecovery.Retry, original.request.requestId)
            assertEquals(1, fixture.commits)
            assertEquals(original.requestJson, fixture.calls.last().second.requestJson)
            assertEquals(original.request, fixture.store.value?.request)
            assertTrue(restarted.canAcknowledge)
        }

    @Test fun cold_terminal_recovery_never_posts_again() =
        runTest {
            val first = fixture.prepared()
            first.submit(fixture.decision)
            fixture.calls.clear()
            val restarted = fixture.coordinator()
            restarted.open()
            val original = requireNotNull(restarted.pending)
            restarted.recover(HomeMemberRemovalRecovery.Retry, original.request.requestId)
            assertTrue(fixture.calls.isEmpty())
            assertTrue(restarted.canAcknowledge)
        }

    @Test fun failed_terminal_proof_write_repairs_without_duplicate_dispatch() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.store.failProof = true
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            val original = requireNotNull(fixture.store.value)
            assertNull(original.receiptJson)
            fixture.store.failProof = false
            coordinator.recover(HomeMemberRemovalRecovery.Retry, original.request.requestId)
            assertEquals(1, fixture.calls.size)
            assertTrue(coordinator.canAcknowledge)
        }

    @Test fun acknowledgement_waits_for_durable_clear_and_reconciles_lost_clear_callback() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            val id = requireNotNull(coordinator.pending).request.requestId
            fixture.store.failClear = true
            assertTrue(runCatching { coordinator.acknowledge(id) }.isFailure)
            assertNotNull(coordinator.pending)
            fixture.store.failClear = false
            fixture.store.clearCommitsThenThrows = true
            assertNotNull(coordinator.acknowledge(id))
            assertNull(fixture.store.value)
            assertNull(coordinator.pending)
        }

    @Test fun another_home_or_scene_cannot_overwrite_existing_original() =
        runTest {
            val first = fixture.prepared()
            val second = fixture.prepared()
            fixture.failBeforeCommit = true
            assertTrue(runCatching { first.submit(fixture.decision) }.isFailure)
            val original = requireNotNull(fixture.store.value)
            assertTrue(runCatching { second.submit(fixture.decision) }.isFailure)
            assertEquals(original, fixture.store.value)
            val reopened = fixture.coordinator()
            assertTrue(runCatching { reopened.open() }.isFailure)
            assertEquals(original, reopened.pending)
            assertFalse(reopened.canPrepare)
        }

    @Test fun unseen_attempt_cancellation_does_not_remove_membership() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.failBeforeCommit = true
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            fixture.failBeforeCommit = false
            coordinator.recover(HomeMemberRemovalRecovery.Cancel, requireNotNull(coordinator.pending).request.requestId)
            assertEquals("cancelled", coordinator.outcome?.state)
            assertEquals(0, fixture.commits)
        }

    @Test fun committed_result_wins_over_cancel_after_lost_reply() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.failAfterCommit = true
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            fixture.failAfterCommit = false
            coordinator.recover(HomeMemberRemovalRecovery.Cancel, requireNotNull(coordinator.pending).request.requestId)
            assertEquals("completed", coordinator.outcome?.state)
            assertEquals(1, fixture.commits)
        }

    @Test fun stale_session_before_dispatch_keeps_original_and_sends_nothing() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.serverSession = "f".repeat(64)
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            assertNotNull(fixture.store.value)
            assertTrue(fixture.calls.isEmpty())
        }

    @Test fun account_change_retires_prepared_submission_without_saving_or_dispatching() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.current = false
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            assertNull(fixture.store.value)
            assertTrue(fixture.calls.isEmpty())
        }

    @Test fun held_reply_is_retired_after_hiding_but_original_remains_recoverable() =
        runTest {
            val coordinator = fixture.prepared()
            val release = CompletableDeferred<Unit>()
            fixture.hold = release
            val sending = launch { assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure) }
            runCurrent()
            assertNotNull(fixture.store.value)
            coordinator.hide()
            release.complete(Unit)
            sending.join()
            assertNull(coordinator.outcome)
            assertNull(fixture.store.value?.receiptJson)
            fixture.hold = null
            val restarted = fixture.coordinator()
            restarted.open()
            assertTrue(restarted.canAcknowledge)
        }

    @Test fun historical_receipt_never_proves_current_membership_and_failed_read_retires_previous_snapshot() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            val id = requireNotNull(coordinator.pending).request.requestId
            val receipt = coordinator.outcome
            assertEquals(HomeMemberRemovalCurrent.Unchecked, coordinator.currentRoster)
            fixture.roster = HomeMemberRemovalCurrent.Listed
            coordinator.checkCurrentRoster(id)
            assertEquals(HomeMemberRemovalCurrent.Listed, coordinator.currentRoster)
            assertEquals(receipt, coordinator.outcome)
            fixture.rosterFails = true
            assertTrue(runCatching { coordinator.checkCurrentRoster(id) }.isFailure)
            assertEquals(HomeMemberRemovalCurrent.Unchecked, coordinator.currentRoster)
            assertEquals(receipt, coordinator.outcome)
            assertEquals(1, fixture.commits)
            assertEquals(1, fixture.calls.size)
        }

    @Test fun hide_retires_held_roster_success_without_touching_receipt() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            val receipt = coordinator.outcome
            fixture.rosterHold = CompletableDeferred()
            val read =
                launch {
                    assertTrue(
                        runCatching { coordinator.checkCurrentRoster(requireNotNull(coordinator.pending).request.requestId) }.isFailure,
                    )
                }
            runCurrent()
            coordinator.hide()
            fixture.rosterHold?.complete(Unit)
            read.join()
            assertEquals(HomeMemberRemovalCurrent.Unchecked, coordinator.currentRoster)
            assertEquals(receipt, coordinator.outcome)
        }

    @Test fun queued_original_write_after_pause_is_refused_inside_storage_without_post() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.store.holdOriginal = CompletableDeferred()
            val sending = launch { assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure) }
            runCurrent()
            assertNull(fixture.store.value)
            coordinator.hide()
            fixture.store.holdOriginal?.complete(Unit)
            sending.join()
            assertNull(fixture.store.value)
            assertTrue(fixture.calls.isEmpty())
        }

    @Test fun queued_proof_after_account_change_preserves_original_for_fresh_recovery() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.store.holdProof = CompletableDeferred()
            val sending = launch { assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure) }
            runCurrent()
            val original = requireNotNull(fixture.store.value)
            assertNull(original.receiptJson)
            fixture.current = false
            fixture.store.holdProof?.complete(Unit)
            sending.join()
            assertEquals(original, fixture.store.value)
            fixture.current = true
            fixture.store.holdProof = null
            val fresh = fixture.coordinator()
            fresh.open()
            assertTrue(fresh.canAcknowledge)
            assertEquals(1, fixture.commits)
        }

    @Test fun queued_acknowledgement_after_pause_cannot_clear_saved_proof() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            val original = requireNotNull(fixture.store.value)
            fixture.store.holdClear = CompletableDeferred()
            val clearing = launch { assertTrue(runCatching { coordinator.acknowledge(original.request.requestId) }.isFailure) }
            runCurrent()
            coordinator.hide()
            fixture.store.holdClear?.complete(Unit)
            clearing.join()
            assertEquals(original, fixture.store.value)
        }

    @Test fun wrong_confirmation_token_is_rejected_before_storage_or_dispatch() =
        runTest {
            val coordinator = fixture.prepared()
            assertTrue(runCatching { coordinator.submit("b".repeat(64)) }.isFailure)
            assertNull(fixture.store.value)
            assertTrue(fixture.calls.isEmpty())
        }
}

internal class RemovalFixture {
    val scope = HomeCreationScope("https://api.pantopus.com/", "ddc24300-0000-4000-8000-000000000001")
    val home = "ddc24300-0000-4000-8000-000000000002"
    val target = "ddc24300-0000-4000-8000-000000000003"
    val occupancy = "ddc24300-0000-4000-8000-000000000005"
    val decision = "a".repeat(64)
    val codec = HomeMemberRemovalCodec(Moshi.Builder().build())
    val store = RemovalFaultStore()
    var current = true
    var serverSession = "e".repeat(64)
    var failBeforeCommit = false
    var failAfterCommit = false
    var failRead = false
    var hold: CompletableDeferred<Unit>? = null
    var rosterHold: CompletableDeferred<Unit>? = null
    var rosterFails = false
    var roster = HomeMemberRemovalCurrent.NotListed
    var commits = 0
    var receipt: HomeMemberRemovalOutcome? = null
    val calls = mutableListOf<Pair<HomeMemberRemovalRecovery, PendingHomeMemberRemoval>>()
    val transport =
        object : HomeMemberRemovalTransport {
            override suspend fun session(scope: HomeCreationScope) = serverSession

            override suspend fun context(
                scope: HomeCreationScope,
                intent: HomeMemberRemovalIntent,
                session: String,
            ) = HomeMemberRemovalContext(intent, occupancy, decision, "Fixture Home\n@member_fixture\nRole: member")

            override suspend fun currentRoster(
                draft: PendingHomeMemberRemoval,
                session: String,
            ): HomeMemberRemovalCurrent {
                check(!rosterFails)
                rosterHold?.await()
                return roster
            }

            override suspend fun resolve(
                draft: PendingHomeMemberRemoval,
                action: HomeMemberRemovalRecovery,
                session: String,
            ): HomeMemberRemovalOutcome {
                check(store.value == draft) { "Original must be durable before dispatch" }
                calls += action to draft
                if (action == HomeMemberRemovalRecovery.Check && failRead) error("Synthetic failed read")
                if (failBeforeCommit) error("Synthetic unavailable command")
                if (receipt == null && action == HomeMemberRemovalRecovery.Check) error("Original not found")
                if (receipt == null) {
                    val state = if (action == HomeMemberRemovalRecovery.Cancel) "cancelled" else "completed"
                    receipt = codec.outcome(resultJson(draft, state), draft)
                    if (state == "completed") commits++
                }
                hold?.await()
                if (failAfterCommit) error("Synthetic lost reply")
                return requireNotNull(receipt)
            }
        }

    fun intent() = HomeMemberRemovalIntent(home, target)

    fun coordinator() = HomeMemberRemovalCoordinator(scope, store, codec, transport, { check(current) })

    suspend fun prepared() =
        coordinator().also {
            it.open()
            it.prepare(intent())
        }

    fun resultJson(
        draft: PendingHomeMemberRemoval,
        state: String = "completed",
        code: String = "MEMBER_REMOVAL_CHANGED",
        status: Int = 409,
    ): String {
        val completed = if (state == "completed") "\"2026-09-13T00:00:00Z\"" else "null"
        val reason = if (state == "rejected") "\"$code\"" else "null"
        val http = if (state == "rejected") status.toString() else "null"
        return """{"state":"$state","home_id":"${draft.request.intent.homeId}","target_user_id":"${draft.request.intent.targetUserId}",
          "occupancy_id":"${draft.request.occupancyId}","action":"remove","decision_token":"${draft.request.decisionToken}",
          "completed_at":$completed,"code":$reason,"status":$http,
          "command":{"actor_id":"${scope.actorId}","request_id":"${draft.request.requestId}",
          "created_at":"2026-09-13T00:00:00Z","updated_at":"2026-09-13T00:00:00Z"},
          "session":{"actor_id":"${scope.actorId}","session_scope":"$serverSession"}}"""
    }

    fun contextJson(): String =
        """{"home_id":"$home","target_user_id":"$target","occupancy_id":"$occupancy","action":"remove",
      "decision_token":"$decision","home":{"id":"$home","name":"Fixture Home"},
      "target":{"id":"$target","name":null,"username":"member_fixture","role_base":"member","is_self":false,"is_active":true,
      "verification_status":"verified","start_at":null,"end_at":null,"access_start_at":null,"access_end_at":null},
      "session":{"actor_id":"${scope.actorId}","session_scope":"$serverSession"}}"""
}

internal class RemovalFaultStore : PendingHomeMemberRemovalStore {
    var value: PendingHomeMemberRemoval? = null
    var failRead = false
    var failOriginal = false
    var failProof = false
    var failClear = false
    var clearCommitsThenThrows = false
    var holdOriginal: CompletableDeferred<Unit>? = null
    var holdProof: CompletableDeferred<Unit>? = null
    var holdClear: CompletableDeferred<Unit>? = null

    override suspend fun read(scope: HomeCreationScope): PendingHomeMemberRemoval? {
        check(!failRead)
        return value?.takeIf { it.scope == scope }
    }

    override suspend fun replace(
        scope: HomeCreationScope,
        expected: PendingHomeMemberRemoval?,
        next: PendingHomeMemberRemoval?,
        requireCurrent: suspend () -> Unit,
    ) {
        check(value == expected)
        if (expected == null && failOriginal) error("Synthetic original write failure")
        if (next?.receiptJson != null && failProof) error("Synthetic proof write failure")
        if (next == null && failClear) error("Synthetic clear failure")
        when {
            next == null -> holdClear?.await()
            expected == null -> holdOriginal?.await()
            next.receiptJson != null -> holdProof?.await()
        }
        requireCurrent()
        value = next
        if (next == null && clearCommitsThenThrows) error("Synthetic callback loss after committed clear")
    }
}
