package app.pantopus.android.ui.screens.homes.residencyhistory

import app.pantopus.android.data.homes.HomeResidencyHistoryReference
import app.pantopus.android.data.homes.HomeResidencyHistorySession
import app.pantopus.android.data.homes.HomeResidencyReviewHistoryCodec
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

internal class HistoryFixture {
    val home = id(1)
    val actor = id(2)
    val scope = HomeResidencyHistorySession(actor, "a".repeat(64))
    val codec = HomeResidencyReviewHistoryCodec(Moshi.Builder().build())
    val created = "2026-09-13T08:09:10.123456Z"
    private val adapter =
        Moshi.Builder().build().adapter<Map<String, Any?>>(
            Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java),
        ).serializeNulls()

    fun id(number: Int) = "00000000-0000-4000-8000-" + number.toString().padStart(12, '0')

    fun item(number: Int = 200): MutableMap<String, Any?> =
        linkedMapOf(
            "decision" to
                linkedMapOf(
                    "id" to id(number), "home_id" to home, "claim_id" to id(3), "actor_id" to actor,
                    "action" to "approve", "created_at" to created, "legacy_request" to false,
                    "result" to
                        linkedMapOf(
                            "status" to "verified",
                            "reviewed_at" to created,
                            "occupancy_id" to id(4),
                            "role_base" to "member",
                        ),
                ),
            "current" to
                linkedMapOf(
                    "claim_status" to "pending", "applicant_lookup" to "current_claim_reference",
                    "applicant" to linkedMapOf("id" to id(5), "username" to "current_household_label", "name" to null),
                    "household_access" to "not_checked",
                ),
        )

    @Suppress("UNCHECKED_CAST")
    fun nested(
        row: Map<String, Any?>,
        key: String,
    ) = row[key] as MutableMap<String, Any?>

    fun envelope(): MutableMap<String, Any?> =
        linkedMapOf(
            "home_id" to home,
            "actor_id" to actor,
            "session" to mapOf("actor_id" to actor, "session_scope" to scope.sessionScope),
        )

    fun page(
        items: List<Map<String, Any?>> = listOf(item()),
        cursor: String? = null,
    ): String =
        json(
            envelope().apply {
                put("items", items)
                put("next_cursor", cursor)
            },
        )

    fun detail(item: Map<String, Any?> = item()): String = json(envelope().apply { put("item", item) })

    fun json(value: Map<String, Any?>): String = adapter.toJson(value)

    fun cursor(
        number: Int = 181,
        created: String = this.created,
        actor: String = this.actor,
        home: String = this.home,
    ): String = encode("{\"version\":1,\"actor_id\":\"$actor\",\"home_id\":\"$home\",\"created_at\":\"$created\",\"id\":\"${id(number)}\"}")

    fun encode(value: String): String = Base64.getUrlEncoder().withoutPadding().encodeToString(value.toByteArray())

    fun reference(number: Int = 200) = HomeResidencyHistoryReference(home, actor, id(number))

    fun decoded(number: Int = 200) = codec.detail(detail(item(number)), reference(number), scope)
}

class HomeResidencyHistoryCodecTest {
    private val f = HistoryFixture()

    private fun rejected(action: () -> Unit) {
        assertTrue("Malformed history must not establish data or an empty list", runCatching(action).isFailure)
    }

    @Test fun all_eight_historical_roles_and_null_legacy_role_remain_descriptive() {
        (HomeResidencyReviewHistoryCodec.ROLES.toList() + null).forEach { role ->
            val row = f.item()
            val decision = f.nested(row, "decision")
            decision["legacy_request"] = true
            f.nested(decision, "result")["role_base"] = role
            val item = f.codec.detail(f.detail(row), f.reference(), f.scope)
            assertEquals(role, item.roleBase)
            assertTrue(item.legacyRequest)
            assertEquals("pending", item.currentClaimStatus)
            assertEquals("verified", item.status)
        }
        assertEquals("Lease resident", historyRole("lease_resident"))
        assertEquals("Service provider", historyRole("service_provider"))
    }

    @Test fun rejected_result_requires_explicit_null_occupancy_and_role() {
        val row = f.item()
        val decision = f.nested(row, "decision")
        decision["action"] = "reject"
        val result = f.nested(decision, "result")
        result["status"] = "rejected"
        result["occupancy_id"] = null
        result["role_base"] = null
        assertNull(f.codec.detail(f.detail(row), f.reference(), f.scope).occupancyId)
        result["role_base"] = "member"
        rejected { f.codec.detail(f.detail(row), f.reference(), f.scope) }
        result["role_base"] = null
        result.remove("occupancy_id")
        rejected { f.codec.detail(f.detail(row), f.reference(), f.scope) }
    }

    @Test fun envelope_actor_home_session_and_receipt_are_exactly_bound() {
        for (key in listOf("home_id", "actor_id", "session")) {
            val row =
                f.envelope().apply {
                    put("item", f.item())
                    put(key, emptyList<String>())
                }
            rejected { f.codec.detail(f.json(row), f.reference(), f.scope) }
        }
        rejected { f.codec.detail(f.detail(), f.reference(201), f.scope) }
        rejected { f.codec.page("[]", f.home, f.scope, null) }
        rejected { f.codec.page("null", f.home, f.scope, null) }
    }

    @Test fun required_nullable_fields_never_default_and_names_are_not_fetched_or_retained() {
        listOf<Any?>("Private account name", emptyList<String>(), false).forEach { name ->
            val row = f.item()
            f.nested(f.nested(row, "current"), "applicant")["name"] = name
            rejected { f.codec.detail(f.detail(row), f.reference(), f.scope) }
        }
        for (field in listOf("name", "username")) {
            val row = f.item()
            f.nested(f.nested(row, "current"), "applicant").remove(field)
            rejected { f.codec.detail(f.detail(row), f.reference(), f.scope) }
        }
        val row = f.item()
        f.nested(row, "current")["applicant"] = null
        f.nested(row, "decision")["review_token"] = "must-never-enter-history-model"
        val value = f.codec.detail(f.detail(row), f.reference(), f.scope)
        assertNull(value.currentApplicant)
        assertFalse(value.toString().contains("must-never-enter-history-model"))
    }

    @Test fun canonical_dates_reject_calendar_normalization_overprecision_and_non_utc_anchors() {
        listOf(
            "2026-02-30T00:00:00.000000Z",
            "0000-01-01T00:00:00.000000Z",
            "2026-01-01T24:00:00.000000Z",
            "2026-01-01T00:00:60.000000Z",
            "2026-01-01T00:00:00.0000000Z",
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:00.000000+00:00",
        ).forEach { time ->
            assertFalse(time, HomeResidencyReviewHistoryCodec.timestamp(time, canonical = true))
            rejected { f.codec.cursor(f.cursor(created = time), f.home, f.actor) }
        }
        assertTrue(HomeResidencyReviewHistoryCodec.timestamp("2024-02-29T23:59:59.123456Z", canonical = true))
        assertTrue(HomeResidencyReviewHistoryCodec.timestamp("2026-01-01T00:00:00.1+23:59"))
        assertFalse(HomeResidencyReviewHistoryCodec.timestamp("2026-01-01T00:00:00+24:00"))
        assertFalse(HomeResidencyReviewHistoryCodec.timestamp("2026-01-01T00:00:00+00:60"))
    }

    @Test fun cursor_canonical_bytes_reject_padding_duplicates_reordering_and_wrong_scope() {
        val canonical = String(Base64.getUrlDecoder().decode(f.cursor()))
        listOf(
            f.cursor() + "=",
            f.encode(canonical.replace("\"version\":1", "\"version\":1.0")),
            f.encode(canonical.replace("\"version\":1", "\"version\":1,\"version\":1")),
            f.encode(canonical.replace("{\"version\":1,", "{").dropLast(1) + ",\"version\":1}"),
            f.cursor(actor = f.id(99)),
            f.cursor(home = f.id(99)),
            "_w",
            "a".repeat(601),
        ).forEach { encoded ->
            rejected { f.codec.cursor(encoded, f.home, f.actor) }
        }
        assertEquals(f.created, f.codec.cursor(f.cursor(), f.home, f.actor).createdAt)
    }

    @Test fun microsecond_ties_page_anchors_duplicates_and_cross_page_progress_are_validated() {
        val values = (200 downTo 181).map(f::item)
        val first = f.codec.page(f.page(values, f.cursor()), f.home, f.scope, null)
        assertEquals(20, first.items.size)
        assertEquals(f.created, first.nextCursor?.createdAt)
        val second = f.codec.page(f.page(listOf(f.item(180))), f.home, f.scope, first.nextCursor)
        assertEquals(f.id(180), second.items.single().id)
        rejected { f.codec.page(f.page(listOf(f.item(181))), f.home, f.scope, first.nextCursor) }
        rejected { f.codec.page(f.page(values.reversed()), f.home, f.scope, null) }
        rejected { f.codec.page(f.page(listOf(f.item(), f.item())), f.home, f.scope, null) }
        rejected { f.codec.page(f.page(values, f.cursor(180)), f.home, f.scope, null) }
        rejected { f.codec.page(f.page(listOf(f.item()), f.cursor()), f.home, f.scope, null) }
        val newer = f.item(179)
        f.nested(newer, "decision")["created_at"] = "2026-09-13T08:09:10.123457Z"
        rejected { f.codec.page(f.page(listOf(newer)), f.home, f.scope, first.nextCursor) }
    }

    @Test fun authorized_empty_is_explicit_and_missing_cursor_or_malformed_item_is_unavailable() {
        assertTrue(f.codec.page(f.page(emptyList()), f.home, f.scope, null).items.isEmpty())
        rejected { f.codec.page(f.json(f.envelope().apply { put("items", emptyList<String>()) }), f.home, f.scope, null) }
        val malformed = f.item().apply { put("decision", emptyList<String>()) }
        rejected { f.codec.page(f.page(listOf(malformed)), f.home, f.scope, null) }
    }
}
