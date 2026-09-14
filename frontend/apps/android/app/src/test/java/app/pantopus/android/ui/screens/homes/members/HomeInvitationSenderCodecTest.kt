package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationSenderRequest
import app.pantopus.android.data.homes.PendingHomeInvitationSender
import app.pantopus.android.data.homes.homeInvitationSenderLink
import app.pantopus.android.data.homes.homeInvitationSenderRows
import com.squareup.moshi.Moshi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeInvitationSenderCodecTest {
    private val fixture = SenderFixture()
    private val request =
        HomeInvitationSenderRequest("ddc24300-0000-4000-8000-000000000004", "b".repeat(64), fixture.intent(), fixture.decision)
    private val original = PendingHomeInvitationSender(fixture.scope, request, fixture.codec.encode(request), "Synthetic recipient")

    @Test fun generated_record_round_trip_preserves_nullable_payload_and_exact_original() {
        val adapter = Moshi.Builder().build().adapter(PendingHomeInvitationSender::class.java).failOnUnknown().serializeNulls()
        val restored = requireNotNull(adapter.fromJson(adapter.toJson(original)))
        assertEquals(original, restored)
        assertTrue(requireNotNull(restored.request.intent.payload).containsKey("message"))
        assertTrue(fixture.codec.valid(restored, fixture.scope))
        assertEquals(original.requestJson, restored.requestJson)
    }

    @Test fun sender_list_rejects_malformed_data_and_keeps_expired_invitation_available_for_withdrawal() {
        val row =
            mapOf(
                "id" to fixture.invitation, "home_id" to fixture.home, "status" to "pending",
                "invitee_email" to null, "invitee_user_id" to fixture.scope.actorId,
                "invitee" to mapOf("id" to fixture.scope.actorId, "username" to "synthetic_recipient", "name" to "Recipient"),
                "created_at" to "2026-09-10T00:00:00Z", "expires_at" to "2026-09-11T00:00:00Z", "proposed_role" to "member",
            )
        val rows = homeInvitationSenderRows(listOf(row), fixture.home)
        assertEquals("Recipient @synthetic_recipient", rows.single().name)
        assertEquals("guest", homeInvitationSenderRows(listOf(row + ("proposed_role_base" to "guest")), fixture.home).single().role)
        assertEquals("member", homeInvitationSenderRows(listOf(row + ("proposed_role_base" to null)), fixture.home).single().role)
        assertTrue(runCatching { homeInvitationSenderRows(null, fixture.home) }.isFailure)
        assertTrue(runCatching { homeInvitationSenderRows(listOf(row, row), fixture.home) }.isFailure)
        assertTrue(runCatching { homeInvitationSenderRows(listOf(row + ("home_id" to fixture.invitation)), fixture.home) }.isFailure)
        assertTrue(runCatching { homeInvitationSenderRows(listOf(row + ("proposed_role" to 42)), fixture.home) }.isFailure)
        assertTrue(runCatching { homeInvitationSenderRows(listOf(row + ("proposed_role_base" to 42)), fixture.home) }.isFailure)
    }

    @Test fun prepared_profile_is_bound_to_recipient_and_dates_must_be_valid() {
        val context = """{"home_id":"${fixture.home}","action":"withdraw","decision_token":"${fixture.decision}",
          "session":{"actor_id":"${fixture.scope.actorId}","session_scope":"${fixture.serverSession}"},
          "invitation":{"id":"${fixture.invitation}","home_id":"${fixture.home}","status":"pending",
          "invitee_user_id":"${fixture.scope.actorId}","invitee_email":null,"proposed_role":"member",
          "proposed_role_base":"member","proposed_preset_key":"restricted_member",
          "invitee":{"id":"${fixture.scope.actorId}","username":"synthetic_recipient","name":"Recipient"},
          "access_start_at":null,"access_end_at":null,"expires_at":"2026-09-11T00:00:00Z"}}"""
        val selected = fixture.codec.context(context, fixture.scope, fixture.serverSession, fixture.intent("withdraw"))
        assertTrue(selected.summary.contains("@synthetic_recipient"))
        assertTrue(selected.summary.contains("Invitation expires:"))
        assertTrue(selected.summary.contains("Permission preset: restricted_member"))
        listOf(
            context.replace("\"proposed_role\":\"member\"", "\"proposed_role\":42"),
            context.replace("\"proposed_role_base\":\"member\"", "\"proposed_role_base\":42"),
            context.replace("\"proposed_preset_key\":\"restricted_member\"", "\"proposed_preset_key\":42"),
        ).forEach { malformed ->
            assertTrue(
                runCatching {
                    fixture.codec.context(malformed, fixture.scope, fixture.serverSession, fixture.intent("withdraw"))
                }.isFailure,
            )
        }
        assertTrue(
            runCatching {
                fixture.codec.context(
                    context.replace("2026-09-11T00:00:00Z", "not-a-date"),
                    fixture.scope,
                    fixture.serverSession,
                    fixture.intent("withdraw"),
                )
            }.isFailure,
        )
    }

    @Test fun prepared_household_approval_displays_effective_base_role_and_friendly_permission_terms() {
        val context = """{"home_id":"${fixture.home}","action":"resend","decision_token":"${fixture.decision}",
          "session":{"actor_id":"${fixture.scope.actorId}","session_scope":"${fixture.serverSession}"},
          "invitation":{"id":"${fixture.invitation}","home_id":"${fixture.home}","status":"pending",
          "invitee_user_id":"${fixture.scope.actorId}","invitee_email":null,"proposed_role":"member",
          "proposed_role_base":"guest","proposed_preset_key":"access_request:synthetic-approved-request",
          "access_start_at":null,"access_end_at":null,"expires_at":"2026-09-11T00:00:00Z"}}"""
        val selected = fixture.codec.context(context, fixture.scope, fixture.serverSession, fixture.intent("resend"))
        assertTrue(selected.summary.contains("Role: guest"))
        assertFalse(selected.summary.contains("Role: member"))
        assertTrue(selected.summary.contains("Household approval"))
        assertFalse(selected.summary.contains("access_request:"))
        val legacy = context.replace("\"proposed_role_base\":\"guest\"", "\"proposed_role_base\":null")
        assertTrue(
            fixture.codec.context(legacy, fixture.scope, fixture.serverSession, fixture.intent("resend")).summary.contains("Role: member"),
        )
    }

    @Test fun exact_original_bytes_and_scope_are_required_for_restoration() {
        assertTrue(fixture.codec.valid(original, fixture.scope))
        assertFalse(fixture.codec.valid(original.copy(requestJson = original.requestJson + " "), fixture.scope))
        assertFalse(fixture.codec.valid(original.copy(request = request.copy(token = "c".repeat(64))), fixture.scope))
        assertFalse(fixture.codec.valid(original, fixture.scope.copy(actorId = fixture.home)))
        val cancellation = fixture.codec.objectFrom(fixture.codec.cancel(original))
        assertFalse(cancellation.containsKey("request_id"))
        assertEquals(fixture.codec.objectFrom(original.requestJson).filterKeys { it != "request_id" }, cancellation)
    }

    @Test fun receipt_projects_away_raw_capabilities_contact_and_session_data() {
        val outcome = fixture.codec.outcome(fixture.resultJson(original), original)
        assertFalse(outcome.receiptJson.contains("must-not-persist"))
        assertFalse(outcome.receiptJson.contains("private recipient content"))
        assertFalse(outcome.receiptJson.contains("session"))
        assertTrue(fixture.codec.valid(original.copy(receiptJson = outcome.receiptJson), fixture.scope))
    }

    @Test fun mismatched_receipts_and_invented_delivery_proof_are_rejected() {
        val valid = fixture.resultJson(original)
        val bad =
            listOf(
                valid.replace(fixture.scope.actorId, fixture.home),
                valid.replace(request.requestId, fixture.home),
                valid.replace(fixture.decision, "c".repeat(64)),
                valid.replace("unconfirmed", "delivered"),
                valid.replace("\"state\":\"completed\"", "\"state\":\"unknown\""),
                valid.replace("\"invitation_id\":\"${fixture.invitation}\"", "\"invitation_id\":null"),
            )
        bad.forEach { assertTrue(runCatching { fixture.codec.outcome(it, original) }.isFailure) }
    }

    @Test fun request_shapes_keep_withdrawal_separate_from_create_and_resend() {
        val withdrawal = request.copy(token = null, intent = fixture.intent("withdraw"))
        assertTrue(withdrawal.isValid())
        assertFalse(withdrawal.copy(token = request.token).isValid())
        assertFalse(request.copy(token = null).isValid())
        val json = fixture.codec.objectFrom(fixture.codec.encode(withdrawal))
        assertTrue(json.containsKey("token"))
        assertNull(json["token"])
        assertFalse(json.containsKey("payload"))
        assertFalse(fixture.codec.objectFrom(original.requestJson).containsKey("invitation_id"))
    }

    @Test fun configured_public_links_match_the_original_server_environment() {
        assertEquals("https://pantopus.com/invite/" + request.token, homeInvitationSenderLink(original, "https://pantopus.com", true))
        assertNull(homeInvitationSenderLink(original, "https://staging.pantopus.com", true))
        assertNull(homeInvitationSenderLink(original, "https://pantopus.com@untrusted.invalid", true))
        assertNull(homeInvitationSenderLink(original, "https://pantopus.com/path", true))
        assertNull(homeInvitationSenderLink(original, "https://pantopus.com", false))
        val local = original.copy(scope = HomeCreationScope("http://10.0.2.2:18083/", fixture.scope.actorId))
        assertNull(homeInvitationSenderLink(local, "https://pantopus.com", true))
        assertEquals("http://localhost:18080/invite/" + request.token, homeInvitationSenderLink(local, "http://localhost:18080", true))
        val unknown = original.copy(scope = fixture.scope.copy(origin = "https://unrecognized.invalid/"))
        assertNull(homeInvitationSenderLink(unknown, "https://pantopus.com", true))
    }

    @Test fun recipient_validation_and_delivery_copy_do_not_claim_inbox_or_push_delivery() {
        assertTrue(senderRecipientValid(" person@example.invalid ", false))
        assertFalse(senderRecipientValid("invalid", false))
        assertTrue(senderRecipientValid("@synthetic_person", true))
        assertFalse(senderRecipientValid("@", true))
        val receipt = fixture.codec.outcome(fixture.resultJson(original), original)
        assertTrue(senderDeliveryText(receipt).contains("Email delivery is unconfirmed"))
        assertTrue(senderDeliveryText(receipt).contains("Push or device delivery is not confirmed"))
        assertTrue(senderConfirmationText("create").contains("separate from residency or ownership"))
        assertEquals("Saved original action: Create invitation", senderOriginalActionText(original))
    }
}
