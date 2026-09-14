package app.pantopus.android.ui.screens.homes.residencyqueue

import app.pantopus.android.data.homes.HomeResidencyQueueCodec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeResidencyQueueCodecTest {
    private val f = QueueFixture()

    private fun rejected(row: Map<String, Any?>) {
        assertTrue(runCatching { f.codec.page(f.json(f.envelope(listOf(row))), f.home, f.scope) }.isFailure)
    }

    @Test fun unknown_references_never_invent_identity_role_or_date() {
        val row = f.item() + mapOf("claimant" to null, "created_at" to null, "claimed_role" to null)
        val claim = f.codec.page(f.json(f.envelope(listOf(row))), f.home, f.scope).claims.single()
        assertEquals("Applicant identity unavailable", claim.applicantLabel)
        assertEquals("Requested relationship unspecified", claim.roleLabel)
        assertEquals("Date unavailable", claim.dateLabel)
        assertEquals("@public_handle", f.decoded().claims.single().applicantLabel)
        assertEquals("Requested 2026-09-13 (UTC)", f.decoded().claims.single().dateLabel)
    }

    @Test fun private_fields_and_malformed_references_reject_the_whole_collection() {
        for ((key, value) in listOf(
            "claimed_address" to "private address", "status" to "verified", "home_id" to f.actor,
            "id" to "bad", "claimed_role" to "member", "claimant" to emptyList<String>(),
            "claimant" to mapOf("id" to f.user, "username" to "public", "name" to "private name"),
            "claimant" to mapOf("id" to f.actor, "username" to "public", "name" to null),
            "claimant" to mapOf("id" to f.user, "username" to "x".repeat(101), "name" to null),
        )) {
            rejected(f.item() + (key to value))
        }
        rejected(f.item() - "created_at")
    }

    @Test fun invalid_calendar_dates_do_not_normalize_into_valid_dates() {
        for (date in listOf(
            "2026-02-29T01:02:03.123456Z",
            "2026-09-31T01:02:03.123456Z",
            "2026-09-13T24:00:00.123456Z",
            "2026-09-13T01:02:03Z",
            "0000-01-01T01:02:03.123456Z",
        )) {
            rejected(f.item() + ("created_at" to date))
        }
        assertTrue(HomeResidencyQueueCodec.timestamp("2024-02-29T23:59:59.999999Z"))
    }

    @Test fun duplicate_claims_applicants_foreign_sessions_and_wrong_order_fail_closed() {
        val next = f.item() + ("id" to f.home)
        for (rows in listOf(listOf(f.item(), f.item()), listOf(f.item(), next))) {
            assertTrue(runCatching { f.codec.page(f.json(f.envelope(rows)), f.home, f.scope) }.isFailure)
        }
        val undated = next + mapOf("user_id" to f.actor, "claimant" to null, "created_at" to null)
        assertEquals(2, f.codec.page(f.json(f.envelope(listOf(f.item(), undated))), f.home, f.scope).claims.size)
        assertTrue(runCatching { f.codec.page(f.json(f.envelope(listOf(undated, f.item()))), f.home, f.scope) }.isFailure)
        assertTrue(runCatching { f.codec.page(f.page().replace(f.actor, f.user), f.home, f.scope) }.isFailure)
        assertTrue(runCatching { f.codec.page(f.page().replace(f.scope.sessionScope, "b".repeat(64)), f.home, f.scope) }.isFailure)
        assertTrue(f.codec.page(f.json(f.envelope(emptyList())), f.home, f.scope).claims.isEmpty())
        assertFalse(runCatching { f.codec.page("{\"claims\":[]}", f.home, f.scope) }.isSuccess)
    }
}
