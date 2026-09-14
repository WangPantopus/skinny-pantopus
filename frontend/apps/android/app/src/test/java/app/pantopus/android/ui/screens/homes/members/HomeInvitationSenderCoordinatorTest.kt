package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationSenderCodec
import app.pantopus.android.data.homes.HomeInvitationSenderContext
import app.pantopus.android.data.homes.HomeInvitationSenderIntent
import app.pantopus.android.data.homes.HomeInvitationSenderOutcome
import app.pantopus.android.data.homes.HomeInvitationSenderRecovery
import app.pantopus.android.data.homes.HomeInvitationSenderTransport
import app.pantopus.android.data.homes.PendingHomeInvitationSender
import app.pantopus.android.data.homes.PendingHomeInvitationSenderStore
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
class HomeInvitationSenderCoordinatorTest {
    private val fixture = SenderFixture()

    @Test fun prepare_does_not_submit_and_original_is_durable_before_dispatch() =
        runTest {
            val coordinator = fixture.coordinator()
            coordinator.open()
            coordinator.prepare(fixture.intent())
            assertTrue(coordinator.canSubmit)
            assertTrue(fixture.calls.isEmpty())
            coordinator.submit(fixture.decision)
            assertEquals(listOf(HomeInvitationSenderRecovery.Retry), fixture.calls.map { it.first })
            val original = requireNotNull(fixture.store.value)
            assertEquals(original.requestJson, fixture.calls.single().second.requestJson)
            assertTrue(coordinator.canAcknowledge)
            assertEquals("unconfirmed", coordinator.outcome?.email)
            assertTrue(senderDeliveryText(requireNotNull(coordinator.outcome)).contains("unconfirmed"))
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
            restarted.recover(HomeInvitationSenderRecovery.Retry, original.request.requestId)
            assertEquals(1, fixture.commits)
            assertEquals(original.requestJson, fixture.calls.last().second.requestJson)
            assertEquals(original.request.token, fixture.store.value?.request?.token)
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
            restarted.recover(HomeInvitationSenderRecovery.Retry, original.request.requestId)
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
            coordinator.recover(HomeInvitationSenderRecovery.Retry, original.request.requestId)
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

    @Test fun unseen_attempt_cancellation_does_not_create_an_invitation() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.failBeforeCommit = true
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            fixture.failBeforeCommit = false
            coordinator.recover(HomeInvitationSenderRecovery.Cancel, requireNotNull(coordinator.pending).request.requestId)
            assertEquals("cancelled", coordinator.outcome?.state)
            assertEquals(0, fixture.commits)
        }

    @Test fun committed_result_wins_over_cancel_after_lost_reply() =
        runTest {
            val coordinator = fixture.prepared()
            fixture.failAfterCommit = true
            assertTrue(runCatching { coordinator.submit(fixture.decision) }.isFailure)
            fixture.failAfterCommit = false
            coordinator.recover(HomeInvitationSenderRecovery.Cancel, requireNotNull(coordinator.pending).request.requestId)
            assertEquals("completed", coordinator.outcome?.state)
            assertEquals(1, fixture.commits)
        }

    @Test fun withdrawal_is_an_invitation_command_with_no_recipient_capability() =
        runTest {
            val coordinator = fixture.prepared("withdraw")
            coordinator.submit(fixture.decision)
            val original = requireNotNull(coordinator.pending)
            assertNull(original.request.token)
            assertFalse(original.requestJson.contains("payload"))
            assertEquals(fixture.invitation, original.request.intent.invitationId)
            assertEquals("not_requested", coordinator.outcome?.email)
            assertTrue(senderOutcomeText("withdraw", requireNotNull(coordinator.outcome)).contains("membership was preserved"))
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

    @Test fun historical_success_requires_fresh_read_only_sharing_check_and_failure_retires_it() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            val original = requireNotNull(coordinator.pending)
            assertNull(coordinator.sharingUntilMillis)
            val writes = fixture.calls.size
            assertEquals(original, coordinator.checkSharing(original.request.requestId))
            assertTrue(requireNotNull(coordinator.sharingUntilMillis) > fixture.nowMillis)
            assertEquals("resend", fixture.contexts.last().action)
            assertEquals(fixture.invitation, fixture.contexts.last().invitationId)
            assertEquals(writes, fixture.calls.size)
            fixture.contextFails = true
            assertTrue(runCatching { coordinator.checkSharing(original.request.requestId) }.isFailure)
            assertNull(coordinator.sharingUntilMillis)
            assertEquals(original, fixture.store.value)
            assertEquals(writes, fixture.calls.size)
        }

    @Test fun expired_invitation_or_withdrawal_receipt_never_permits_sharing() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            fixture.contextExpires = "2020-01-01T00:00:00Z"
            assertTrue(runCatching { coordinator.checkSharing(requireNotNull(coordinator.pending).request.requestId) }.isFailure)
            assertNull(coordinator.sharingUntilMillis)
            fixture.store.value = null
            fixture.receipt = null
            val withdrawal = fixture.prepared("withdraw")
            withdrawal.submit(fixture.decision)
            assertTrue(runCatching { withdrawal.checkSharing(requireNotNull(withdrawal.pending).request.requestId) }.isFailure)
            assertNull(withdrawal.sharingUntilMillis)
        }

    @Test fun hiding_retires_a_held_sharing_check_without_erasing_original() =
        runTest {
            val coordinator = fixture.prepared()
            coordinator.submit(fixture.decision)
            val original = requireNotNull(coordinator.pending)
            val release = CompletableDeferred<Unit>()
            fixture.contextHold = release
            val checking = launch { assertTrue(runCatching { coordinator.checkSharing(original.request.requestId) }.isFailure) }
            runCurrent()
            coordinator.hide()
            release.complete(Unit)
            checking.join()
            assertNull(coordinator.sharingUntilMillis)
            assertEquals(original, fixture.store.value)
            assertEquals(1, fixture.calls.size)
        }

    @Test fun wrong_confirmation_token_is_rejected_before_storage_or_dispatch() =
        runTest {
            val coordinator = fixture.prepared()
            assertTrue(runCatching { coordinator.submit("b".repeat(64)) }.isFailure)
            assertNull(fixture.store.value)
            assertTrue(fixture.calls.isEmpty())
        }
}

internal class SenderFixture {
    val scope = HomeCreationScope("https://api.pantopus.com/", "ddc24300-0000-4000-8000-000000000001")
    val home = "ddc24300-0000-4000-8000-000000000002"
    val invitation = "ddc24300-0000-4000-8000-000000000003"
    val decision = "a".repeat(64)
    val codec = HomeInvitationSenderCodec(Moshi.Builder().build())
    val store = SenderFaultStore()
    var current = true
    var nowMillis = java.time.Instant.parse("2026-09-12T00:00:00Z").toEpochMilli()
    var contextFails = false
    var contextExpires: String? = null
    var contextHold: CompletableDeferred<Unit>? = null
    val contexts = mutableListOf<HomeInvitationSenderIntent>()
    var serverSession = "e".repeat(64)
    var failBeforeCommit = false
    var failAfterCommit = false
    var failRead = false
    var hold: CompletableDeferred<Unit>? = null
    var commits = 0
    var receipt: HomeInvitationSenderOutcome? = null
    val calls = mutableListOf<Pair<HomeInvitationSenderRecovery, PendingHomeInvitationSender>>()
    val transport =
        object : HomeInvitationSenderTransport {
            override suspend fun session(scope: HomeCreationScope) = serverSession

            override suspend fun context(
                scope: HomeCreationScope,
                intent: HomeInvitationSenderIntent,
                session: String,
            ): HomeInvitationSenderContext {
                contexts += intent
                check(!contextFails)
                contextHold?.await()
                return HomeInvitationSenderContext(intent, decision, "synthetic@example.invalid\nmember", contextExpires)
            }

            override suspend fun resolve(
                draft: PendingHomeInvitationSender,
                action: HomeInvitationSenderRecovery,
                session: String,
            ): HomeInvitationSenderOutcome {
                check(store.value == draft) { "Original must be durable before dispatch" }
                calls += action to draft
                if (action == HomeInvitationSenderRecovery.Check && failRead) error("Synthetic failed read")
                if (failBeforeCommit) error("Synthetic unavailable command")
                if (receipt == null && action == HomeInvitationSenderRecovery.Check) error("Original not found")
                if (receipt == null) {
                    val state = if (action == HomeInvitationSenderRecovery.Cancel) "cancelled" else "completed"
                    receipt = codec.outcome(resultJson(draft, state), draft)
                    if (state == "completed") commits++
                }
                hold?.await()
                if (failAfterCommit) error("Synthetic lost reply")
                return requireNotNull(receipt)
            }
        }

    fun intent(action: String = "create") =
        HomeInvitationSenderIntent(
            home,
            action,
            payload =
                if (action == "create") {
                    linkedMapOf(
                        "email" to "synthetic@example.invalid",
                        "relationship" to "member",
                        "message" to null,
                    )
                } else {
                    null
                },
            invitationId = invitation.takeIf { action != "create" },
        )

    fun coordinator() = HomeInvitationSenderCoordinator(scope, store, codec, transport, { check(current) }, nowMillis = { nowMillis })

    suspend fun prepared(action: String = "create") =
        coordinator().also {
            it.open()
            it.prepare(intent(action))
        }

    fun resultJson(
        draft: PendingHomeInvitationSender,
        state: String = "completed",
    ): String {
        val sends = state == "completed" && draft.request.intent.action != "withdraw"
        val id = if (state != "completed" && draft.request.intent.action == "create") "null" else "\"$invitation\""
        return """{"state":"$state","home_id":"$home","invitation_id":$id,"action":"${draft.request.intent.action}",
            "decision_token":"${draft.request.decisionToken}",
            "command":{"actor_id":"${scope.actorId}","request_id":"${draft.request.requestId}",
            "created_at":"2026-09-12T00:00:00Z","updated_at":"2026-09-12T00:00:00Z"},
            "delivery":{"email":"${if (sends) "unconfirmed" else "not_requested"}","in_app":"${if (sends) "saved" else "not_requested"}"},
            "session":{"actor_id":"${scope.actorId}","session_scope":"$serverSession"},
            "token":"must-not-persist","message":"private recipient content"}"""
    }
}

internal class SenderFaultStore : PendingHomeInvitationSenderStore {
    var value: PendingHomeInvitationSender? = null
    var failRead = false
    var failOriginal = false
    var failProof = false
    var failClear = false
    var clearCommitsThenThrows = false

    override suspend fun read(scope: HomeCreationScope): PendingHomeInvitationSender? {
        check(!failRead)
        return value?.takeIf { it.scope == scope }
    }

    override suspend fun replace(
        scope: HomeCreationScope,
        expected: PendingHomeInvitationSender?,
        next: PendingHomeInvitationSender?,
    ) {
        check(value == expected)
        if (expected == null && failOriginal) error("Synthetic original write failure")
        if (next?.receiptJson != null && failProof) error("Synthetic proof write failure")
        if (next == null && failClear) error("Synthetic clear failure")
        value = next
        if (next == null && clearCommitsThenThrows) error("Synthetic callback loss after committed clear")
    }
}
