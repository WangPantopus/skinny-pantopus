package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.homes.HomeMemberRemovalCurrent
import app.pantopus.android.data.homes.HomeMemberRemovalRequest
import app.pantopus.android.data.homes.PendingHomeMemberRemoval
import com.squareup.moshi.Moshi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeMemberRemovalCodecTest {
    private val fixture = RemovalFixture()
    private val request =
        HomeMemberRemovalRequest("ddc24300-0000-4000-8000-000000000004", fixture.intent(), fixture.occupancy, fixture.decision)
    private val original = PendingHomeMemberRemoval(fixture.scope, request, fixture.codec.encode(request), "Fixture Home\n@member_fixture")

    @Test fun generated_original_round_trip_preserves_exact_bytes_and_nullable_proof() {
        val adapter = Moshi.Builder().build().adapter(PendingHomeMemberRemoval::class.java).failOnUnknown().serializeNulls()
        val restored = requireNotNull(adapter.fromJson(adapter.toJson(original)))
        assertEquals(original, restored)
        assertTrue(fixture.codec.valid(restored, fixture.scope))
        listOf("null", "false", "0", "[]", "{}", "\"\"").forEach { json ->
            assertFalse(runCatching { adapter.fromJson(json)?.let { fixture.codec.valid(it, fixture.scope) } == true }.getOrDefault(false))
        }
        assertFalse(fixture.codec.valid(original.copy(requestJson = original.requestJson + " "), fixture.scope))
        assertFalse(fixture.codec.valid(original.copy(request = request.copy(occupancyId = fixture.home)), fixture.scope))
        assertFalse(fixture.codec.valid(original.copy(summary = ""), fixture.scope))
        assertFalse(fixture.codec.valid(original, fixture.scope.copy(actorId = fixture.home)))
        assertFalse(fixture.codec.valid(original, fixture.scope.copy(origin = "https://other.invalid/")))
    }

    @Test fun exact_request_and_cancel_shapes_have_no_invitation_capability_or_mutable_display() {
        val row = fixture.codec.objectFrom(original.requestJson)
        assertEquals(setOf("request_id", "home_id", "target_user_id", "occupancy_id", "action", "decision_token"), row.keys)
        assertEquals("remove", row["action"])
        assertEquals(row.filterKeys { it != "request_id" }, fixture.codec.objectFrom(fixture.codec.cancel(original)))
    }

    @Test fun current_review_validates_identity_canonical_role_boolean_and_nullable_dates() {
        val json = fixture.contextJson()
        val prepared = fixture.codec.context(json, fixture.scope, fixture.serverSession, fixture.intent())
        assertTrue(prepared.summary.contains("Fixture Home\n@member_fixture"))
        assertTrue(prepared.summary.contains("Role: member"))
        for (role in listOf("lease_resident", "service_provider")) {
            assertTrue(
                fixture.codec.context(
                    json.replace("\"role_base\":\"member\"", "\"role_base\":\"$role\""),
                    fixture.scope,
                    fixture.serverSession,
                    fixture.intent(),
                ).summary.contains("Role: $role"),
            )
        }
        val malformed =
            listOf(
                json.replace("\"is_active\":true", "\"is_active\":\"true\""),
                json.replace("\"is_self\":false", "\"is_self\":true"),
                json.replace("\"role_base\":\"member\"", "\"role_base\":42"),
                json.replace("\"role_base\":\"member\"", "\"role_base\":null"),
                json.replace("\"name\":null", "\"name\":false"),
                json.replace("\"name\":null", "\"name\":\"Unshared account name\""),
                json.replace("\"name\":null", "\"name\":[]"),
                json.replace("\"username\":\"member_fixture\"", "\"username\":[]"),
                json.replace("\"start_at\":null", "\"start_at\":\"not-a-date\""),
                json.replace("\"end_at\":null,", ""),
                json.replace("\"id\":\"${fixture.target}\"", "\"id\":\"${fixture.home}\""),
                json.replace(fixture.serverSession, "b".repeat(64)),
            )
        malformed.forEach {
            assertTrue(runCatching { fixture.codec.context(it, fixture.scope, fixture.serverSession, fixture.intent()) }.isFailure)
        }
    }

    @Test fun unknown_historical_role_is_only_reviewable_for_actual_self_leave() {
        val intent = fixture.intent().copy(targetUserId = fixture.scope.actorId)
        val json =
            fixture.contextJson().replace(fixture.target, fixture.scope.actorId)
                .replace("\"is_self\":false", "\"is_self\":true").replace("\"role_base\":\"member\"", "\"role_base\":null")
        assertTrue(fixture.codec.context(json, fixture.scope, fixture.serverSession, intent).summary.contains("Your household membership"))
    }

    @Test fun historical_proof_excludes_session_and_binds_every_original_identity() {
        val valid = fixture.resultJson(original)
        val outcome = fixture.codec.outcome(valid, original)
        assertFalse(outcome.receiptJson.contains("session"))
        assertTrue(fixture.codec.valid(original.copy(receiptJson = outcome.receiptJson), fixture.scope))
        listOf(
            valid.replace(fixture.home, fixture.target), valid.replace(fixture.target, fixture.home),
            valid.replace(fixture.occupancy, fixture.home), valid.replace(fixture.scope.actorId, fixture.home),
            valid.replace(request.requestId, fixture.home), valid.replace(fixture.decision, "b".repeat(64)),
            valid.replace("\"action\":\"remove\"", "\"action\":\"withdraw\""),
            valid.replace("\"completed_at\":\"2026-09-13T00:00:00Z\"", "\"completed_at\":null"),
            valid.replace("\"code\":null", "\"code\":false"), valid.replace("\"status\":null", "\"status\":200"),
            valid.replace("\"state\":\"completed\"", "\"state\":\"unknown\""), "[]", "null", "false",
        ).forEach { assertTrue(runCatching { fixture.codec.outcome(it, original) }.isFailure) }
    }

    @Test fun only_allowlisted_durable_rejections_and_matching_status_are_terminal() {
        val codes =
            mapOf(
                "MEMBER_REMOVAL_CHANGED" to 409, "MEMBER_ALREADY_REMOVED" to 409,
                "MEMBERS_MANAGE_REQUIRED" to 403, "TARGET_RANK_FORBIDDEN" to 403, "OWNERSHIP_FLOW_REQUIRED" to 409,
                "TRANSFER_REQUIRED" to 409, "MEMBER_ROLE_UNKNOWN" to 409, "MEMBER_NOT_FOUND" to 404, "HOME_NOT_FOUND" to 404,
            )
        codes.forEach { (code, status) ->
            assertEquals(status, fixture.codec.outcome(fixture.resultJson(original, "rejected", code, status), original).status)
            assertTrue(runCatching { fixture.codec.outcome(fixture.resultJson(original, "rejected", code, 400), original) }.isFailure)
        }
        listOf("MEMBER_REMOVAL_INVALID", "MEMBER_REMOVAL_CONFLICT", "MEMBER_REMOVAL_UNAVAILABLE", "MEMBER_REMOVAL_NOT_FOUND").forEach {
            assertTrue(runCatching { fixture.codec.outcome(fixture.resultJson(original, "rejected", it), original) }.isFailure)
        }
        for (state in listOf("cancelled", "pending")) {
            assertEquals(state, fixture.codec.outcome(fixture.resultJson(original, state), original).state)
            assertTrue(
                runCatching {
                    fixture.codec.outcome(
                        fixture.resultJson(original, state).replace("\"completed_at\":null", "\"completed_at\":\"2026-09-13T00:00:00Z\""),
                        original,
                    )
                }.isFailure,
            )
        }
    }

    @Test fun malformed_roster_cannot_prove_absence_and_duplicate_identity_is_rejected() {
        val row = """{"id":"${fixture.occupancy}","home_id":"${fixture.home}","user_id":"${fixture.target}","is_active":true}"""
        assertEquals(HomeMemberRemovalCurrent.Listed, fixture.codec.currentRoster("""{"occupants":[$row]}""", fixture.intent()))
        assertEquals(HomeMemberRemovalCurrent.NotListed, fixture.codec.currentRoster("""{"occupants":[]}""", fixture.intent()))
        for (malformedRow in listOf(row.replace("\"home_id\":\"${fixture.home}\",", ""), row.replace(fixture.home, fixture.target))) {
            assertTrue(runCatching { fixture.codec.currentRoster("""{"occupants":[$malformedRow]}""", fixture.intent()) }.isFailure)
        }
        listOf(
            "{}",
            """{"occupants":null}""",
            """{"occupants":false}""",
            """{"occupants":[$row,$row]}""",
            """{"occupants":[${row.replace("true", "\"true\"")}]}""",
        ).forEach {
            assertTrue(runCatching { fixture.codec.currentRoster(it, fixture.intent()) }.isFailure)
        }
    }
}
