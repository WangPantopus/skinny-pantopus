@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.token_accept

import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationDecisionCodec
import app.pantopus.android.data.homes.HomeInvitationDecisionContext
import app.pantopus.android.data.homes.HomeInvitationDecisionOutcome
import app.pantopus.android.data.homes.HomeInvitationDecisionTransport
import app.pantopus.android.data.homes.HomeInvitationPreview
import app.pantopus.android.data.homes.HomeInvitationRecoveryAction
import app.pantopus.android.data.homes.PendingHomeInvitationDecision
import app.pantopus.android.data.homes.PendingHomeInvitationDecisionStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeInvitationDecisionCoordinatorTest {
    private val scope = HomeCreationScope("https://example.invalid/", "ddc24300-0000-4000-8000-000000000001")
    private val home = "ddc24300-0000-4000-8000-000000000002"
    private val invitation = "ddc24300-0000-4000-8000-000000000003"
    private val session = "e".repeat(64)
    private val codec = HomeInvitationDecisionCodec(Moshi.Builder().build())
    private val store = FaultStore()
    private var sends = 0
    private val transport =
        object : HomeInvitationDecisionTransport {
            override suspend fun preview(token: String) = HomeInvitationPreview.Found

            override suspend fun session(scope: HomeCreationScope) = session

            override suspend fun context(
                scope: HomeCreationScope,
                token: String,
                session: String,
            ) = HomeInvitationDecisionContext(
                home, invitation,
                "a".repeat(
                    64,
                ),
                "My Home", "Test", "The household", "member", null, null, null,
            )

            override suspend fun resolve(
                draft: PendingHomeInvitationDecision,
                action: HomeInvitationRecoveryAction,
                session: String,
            ): HomeInvitationDecisionOutcome {
                sends++
                val request = draft.request
                return codec.outcome(
                    """{
              "state":"completed","home_id":"$home","invitation_id":"$invitation","action":"accept",
              "decision_token":"${request.decisionToken}","occupancy_id":"ddc24300-0000-4000-8000-000000000005",
              "current_access":"not_checked","command":{"actor_id":"${scope.actorId}","request_id":"${request.requestId}",
              "created_at":"2026-09-12T00:00:00Z","updated_at":"2026-09-12T00:00:00Z"},"session":{"ignored":"ephemeral"}
            }""",
                    draft,
                )
            }

            override suspend fun access(homeId: String): PersonalHomeResidencyProgress = error("No access read expected")
        }

    private fun coordinator() = HomeInvitationDecisionCoordinator(scope, "synthetic-invitation", store, codec, transport, {})

    @Test fun original_storage_failure_prevents_a_post_or_another_choice() =
        runTest {
            val coordinator = coordinator()
            coordinator.open()
            assertTrue(coordinator.canDecide)
            store.failOriginal = true
            assertTrue(runCatching { coordinator.decide("accept", "a".repeat(64)) }.isFailure)
            assertEquals(0, sends)
            assertFalse(coordinator.canDecide)
            assertNull(store.value)
        }

    @Test fun terminal_proof_repair_does_not_post_again_and_committed_clear_is_reconciled() =
        runTest {
            val coordinator = coordinator()
            coordinator.open()
            store.failProof = true
            assertTrue(runCatching { coordinator.decide("accept", "a".repeat(64)) }.isFailure)
            val original = requireNotNull(store.value)
            assertEquals(1, sends)
            assertNull(original.receiptJson)
            store.failProof = false
            coordinator.recover(HomeInvitationRecoveryAction.Retry, original.request.requestId)
            assertEquals(1, sends)
            assertNotNull(store.value?.receiptJson)
            assertFalse(requireNotNull(store.value?.receiptJson).contains("ephemeral"))
            assertTrue(coordinator.canAcknowledge)
            store.clearCommitsThenThrows = true
            assertNotNull(coordinator.acknowledge(original.request.requestId, false))
            assertNull(store.value)
            assertNull(coordinator.pending)
        }

    private class FaultStore : PendingHomeInvitationDecisionStore {
        var value: PendingHomeInvitationDecision? = null
        var failOriginal = false
        var failProof = false
        var clearCommitsThenThrows = false

        override suspend fun read(scope: HomeCreationScope) = value

        override suspend fun replace(
            scope: HomeCreationScope,
            expected: PendingHomeInvitationDecision?,
            next: PendingHomeInvitationDecision?,
        ) {
            check(value == expected)
            if (expected == null && failOriginal) error("Synthetic original write failure")
            if (next?.receiptJson != null && failProof) error("Synthetic proof write failure")
            value = next
            if (next == null && clearCommitsThenThrows) error("Synthetic callback loss after committed clear")
        }
    }
}
